/**
 * Git-as-DB snapshot loader.
 *
 * The pipeline cron writes a JSON snapshot per run to
 * `services/data-pipeline/snapshots/<bank>/latest.json` and commits it back
 * to the repo. The web reads these files as a fallback when Supabase is empty
 * or unreachable (the free tier pauses inactive projects).
 *
 * Two read paths:
 *   1. Local filesystem (dev, or when Vercel deploys from repo root).
 *   2. GitHub raw URL (production, when apps/web is the Vercel root dir and
 *      the snapshots dir is not bundled).
 *
 * Cached for 5 minutes via Next's `fetch` cache to keep cost low.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { BankCode, MeetingProbabilities, Outcome } from "./types";

interface SnapshotRow {
  meeting_date: string;
  outcome_label: string;
  outcome_delta_bps: number;
  probability: number;
  post_meeting_rate: number;
}

interface SnapshotFile {
  bank_code: string;
  snapshot_at: string;
  methodology_version?: string;
  rows: SnapshotRow[];
}

const REPO_OWNER = "lawoflarge";
const REPO_NAME = "rateradar";
const REPO_BRANCH = "main";

// Turbopack flags `process.cwd()` joins as non-statically-analyzable.
// That's fine — the path is intentionally runtime, since the same code path
// supports both dev (monorepo cwd) and prod (apps/web build root).
const candidateLocalPaths = (bankLower: string) => [
  path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "../../services/data-pipeline/snapshots",
    bankLower,
    "latest.json",
  ),
  path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "services/data-pipeline/snapshots",
    bankLower,
    "latest.json",
  ),
];

function rawGithubUrl(bankLower: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/services/data-pipeline/snapshots/${bankLower}/latest.json`;
}

async function readLocal(bankLower: string): Promise<SnapshotFile | null> {
  for (const p of candidateLocalPaths(bankLower)) {
    try {
      const txt = await fs.readFile(p, "utf-8");
      return JSON.parse(txt) as SnapshotFile;
    } catch {
      // try next path
    }
  }
  return null;
}

async function readRemote(bankLower: string): Promise<SnapshotFile | null> {
  try {
    const res = await fetch(rawGithubUrl(bankLower), {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SnapshotFile;
  } catch {
    return null;
  }
}

export async function loadJsonSnapshot(
  bank: BankCode,
): Promise<MeetingProbabilities[] | null> {
  const bankLower = bank.toLowerCase();
  const file = (await readLocal(bankLower)) ?? (await readRemote(bankLower));
  if (!file || !Array.isArray(file.rows) || file.rows.length === 0) return null;

  const grouped = new Map<string, SnapshotRow[]>();
  for (const row of file.rows) {
    const list = grouped.get(row.meeting_date) ?? [];
    list.push(row);
    grouped.set(row.meeting_date, list);
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const result: MeetingProbabilities[] = [];
  for (const [meetingDate, rows] of grouped) {
    if (meetingDate < todayISO) continue;
    rows.sort((a, b) => a.outcome_delta_bps - b.outcome_delta_bps);
    const outcomes: Outcome[] = rows.map((r) => ({
      id: `${bank}-${meetingDate}-${r.outcome_delta_bps}`,
      label: r.outcome_label,
      delta_bps: r.outcome_delta_bps,
      probability: r.probability,
      post_meeting_rate: r.post_meeting_rate,
    }));

    result.push({
      meeting: {
        id: `${bank}-${meetingDate}`,
        bank_code: bank,
        meeting_date: meetingDate,
        status: "scheduled",
      },
      snapshot_at: file.snapshot_at,
      outcomes,
    });
  }

  result.sort((a, b) =>
    a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1,
  );
  return result.length > 0 ? result : null;
}

export async function loadJsonSnapshotAt(
  bank: BankCode,
): Promise<{ at: string; version: string | null } | null> {
  const bankLower = bank.toLowerCase();
  const file = (await readLocal(bankLower)) ?? (await readRemote(bankLower));
  if (!file) return null;
  return { at: file.snapshot_at, version: file.methodology_version ?? null };
}
