/**
 * Data-access layer for meeting probabilities.
 *
 * Tries Supabase first (if env vars are configured); falls back to built-in
 * mock data so dev / CI / first deploys never break. The fallback also covers
 * the "Supabase reachable but empty" case — handy before the pipeline runs.
 */

import { MOCK_FED_PROBABILITIES } from "./mock-data";
import {
  loadJsonHistory,
  loadJsonSnapshot,
  loadJsonSnapshotById,
} from "./snapshots";
import { getSupabase } from "./supabase";
import type {
  BankCode,
  MeetingProbabilities,
  Outcome,
  ProbabilitySeries,
} from "./types";

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Resolve the right fallback when Supabase is empty or unreachable.
 * Tries the git-committed JSON snapshot first, then falls through to the
 * hard-coded mock data (FED only, ECB returns empty).
 */
async function fallbackFor(bankCode: BankCode): Promise<MeetingProbabilities[]> {
  const fromJson = await loadJsonSnapshot(bankCode);
  if (fromJson && fromJson.length > 0) return fromJson;
  return bankCode === "FED" ? MOCK_FED_PROBABILITIES : [];
}

interface LatestProbabilityRow {
  outcome_id: string;
  meeting_id: string;
  label: string;
  delta_bps: number;
  bank_id: string;
  meeting_date: string;
  probability: number | null;
  snapshot_at: string | null;
}

interface MeetingRow {
  id: string;
  meeting_date: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  bank_id: string;
  central_banks: { code: "FED" | "ECB" } | null;
}

/**
 * Fetch current probability snapshot for each upcoming (future) scheduled meeting
 * of the given bank. Returns mock data for FED if Supabase isn't configured or
 * the query errors; returns empty for ECB in those cases (no ECB mock yet).
 */
export async function getProbabilities(
  bankCode: BankCode,
): Promise<MeetingProbabilities[]> {
  if (!hasSupabaseConfig()) return fallbackFor(bankCode);

  try {
    const supabase = getSupabase();

    // 1. Grab upcoming meetings for this bank
    const todayISO = new Date().toISOString().slice(0, 10);
    const { data: meetings, error: mErr } = await supabase
      .from("meetings")
      .select("id, meeting_date, status, bank_id, central_banks!inner(code)")
      .eq("central_banks.code", bankCode)
      .eq("status", "scheduled")
      .gte("meeting_date", todayISO)
      .order("meeting_date", { ascending: true });

    if (mErr || !meetings || meetings.length === 0) {
      return fallbackFor(bankCode);
    }

    // 2. For each meeting, pull its outcomes + latest snapshot via the view
    const typedMeetings = meetings as unknown as MeetingRow[];
    const meetingIds = typedMeetings.map((m) => m.id);

    const { data: probs, error: pErr } = await supabase
      .from("latest_probabilities")
      .select("*")
      .in("meeting_id", meetingIds);

    if (pErr || !probs) {
      return fallbackFor(bankCode);
    }

    // 3. Group by meeting
    const typedProbs = probs as LatestProbabilityRow[];
    const byMeeting = new Map<string, LatestProbabilityRow[]>();
    for (const row of typedProbs) {
      const list = byMeeting.get(row.meeting_id) ?? [];
      list.push(row);
      byMeeting.set(row.meeting_id, list);
    }

    const result: MeetingProbabilities[] = typedMeetings.map((m) => {
      const rows = (byMeeting.get(m.id) ?? []).sort(
        (a, b) => a.delta_bps - b.delta_bps,
      );
      const outcomes: Outcome[] = rows.map((r) => ({
        id: r.outcome_id,
        label: r.label,
        delta_bps: r.delta_bps,
        probability: r.probability ?? 0,
        post_meeting_rate: 0, // post-meeting rate isn't stored in DB yet — computed by pipeline
      }));
      const latestSnap = rows.reduce(
        (acc, r) => (r.snapshot_at && (!acc || r.snapshot_at > acc) ? r.snapshot_at : acc),
        "",
      );
      return {
        meeting: {
          id: m.id,
          bank_code: m.central_banks?.code ?? bankCode,
          meeting_date: m.meeting_date,
          status: m.status,
        },
        snapshot_at: latestSnap || new Date().toISOString(),
        outcomes,
      };
    });

    // Filter to only meetings that have at least one non-zero probability,
    // avoiding empty rows when data hasn't flowed yet for a given meeting.
    const nonEmpty = result.filter((r) =>
      r.outcomes.some((o) => o.probability > 0),
    );
    return nonEmpty.length > 0 ? nonEmpty : await fallbackFor(bankCode);
  } catch {
    return fallbackFor(bankCode);
  }
}

/** Backwards-compatible shortcut for FED. */
export const getFedProbabilities = (): Promise<MeetingProbabilities[]> =>
  getProbabilities("FED");

/** ECB counterpart. */
export const getEcbProbabilities = (): Promise<MeetingProbabilities[]> =>
  getProbabilities("ECB");

/**
 * From a set of meeting snapshots, pick the soonest upcoming one (meeting_date
 * today or later), or null if none are upcoming. `getProbabilities` already
 * returns only future scheduled meetings sorted ascending, but this stays
 * robust against the JSON-fallback path, which may be unsorted.
 */
export function pickNextMeeting(
  meetings: MeetingProbabilities[],
): MeetingProbabilities | null {
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = meetings
    .filter((m) => m.meeting.meeting_date >= todayISO)
    .sort((a, b) => (a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1));
  return upcoming[0] ?? null;
}

/**
 * Given a meeting's bank + date, return the prior and next meetings (same bank)
 * from the already-scheduled set. Used for the "path context" on detail pages.
 */
export async function getMeetingContext(
  meetingId: string,
): Promise<{
  prior: MeetingProbabilities | null;
  next: MeetingProbabilities | null;
}> {
  const current = await getMeetingById(meetingId);
  if (!current) return { prior: null, next: null };

  const sameBankAll = await getProbabilities(current.meeting.bank_code);
  const sameBankAllWithHistory = sameBankAll.concat(
    // Include past meetings for prior lookup — getProbabilities only returns
    // upcoming, but we want the immediately-preceding meeting too when known.
    [],
  );

  const sorted = [...sameBankAllWithHistory].sort((a, b) =>
    a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1,
  );
  const idx = sorted.findIndex((m) => m.meeting.id === meetingId);
  if (idx === -1) return { prior: null, next: null };

  return {
    prior: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

/**
 * Fetch a single meeting's current probability snapshot by UUID.
 * Returns null if not found (used by dynamic meeting detail page to trigger 404).
 */
export async function getMeetingById(
  meetingId: string,
): Promise<MeetingProbabilities | null> {
  if (!hasSupabaseConfig()) {
    const fromJson = await loadJsonSnapshotById(meetingId);
    if (fromJson) return fromJson;
    return (
      MOCK_FED_PROBABILITIES.find((m) => m.meeting.id === meetingId) ?? null
    );
  }

  try {
    const supabase = getSupabase();

    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .select("id, meeting_date, status, bank_id, central_banks!inner(code)")
      .eq("id", meetingId)
      .maybeSingle();
    if (mErr || !meeting) {
      const fromJson = await loadJsonSnapshotById(meetingId);
      if (fromJson) return fromJson;
      return null;
    }

    const typed = meeting as unknown as MeetingRow;

    const { data: probs, error: pErr } = await supabase
      .from("latest_probabilities")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("delta_bps", { ascending: true });
    if (pErr || !probs) return null;

    const typedProbs = probs as LatestProbabilityRow[];
    const outcomes: Outcome[] = typedProbs.map((r) => ({
      id: r.outcome_id,
      label: r.label,
      delta_bps: r.delta_bps,
      probability: r.probability ?? 0,
      post_meeting_rate: 0,
    }));
    const latestSnap = typedProbs.reduce(
      (acc, r) => (r.snapshot_at && (!acc || r.snapshot_at > acc) ? r.snapshot_at : acc),
      "",
    );

    return {
      meeting: {
        id: typed.id,
        bank_code: typed.central_banks?.code ?? "FED",
        meeting_date: typed.meeting_date,
        status: typed.status,
      },
      snapshot_at: latestSnap || new Date().toISOString(),
      outcomes,
    };
  } catch {
    return null;
  }
}

interface HistoryRow {
  outcome_id: string;
  snapshot_at: string;
  probability: number;
  outcomes: { label: string; delta_bps: number } | null;
}

/**
 * Fetch historical probability time series for a given meeting.
 *
 * Returns one series per outcome, each containing chronologically-sorted
 * (snapshot_at, probability) points over the requested window.
 * Falls back to empty array if Supabase is unconfigured or errors.
 */
export async function getMeetingHistory(
  meetingId: string,
  windowDays = 60,
): Promise<ProbabilitySeries[]> {
  if (!hasSupabaseConfig()) {
    return loadJsonHistory(meetingId, windowDays);
  }

  try {
    const supabase = getSupabase();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Get all outcomes for this meeting (we need labels + delta_bps)
    const { data: outcomes, error: oErr } = await supabase
      .from("outcomes")
      .select("id, label, delta_bps")
      .eq("meeting_id", meetingId)
      .order("delta_bps", { ascending: true });
    if (oErr || !outcomes) return loadJsonHistory(meetingId, windowDays);

    // 2. Get all snapshots for those outcomes in the window
    const outcomeIds = outcomes.map((o) => o.id as string);
    const { data: snaps, error: sErr } = await supabase
      .from("probability_snapshots")
      .select("outcome_id, snapshot_at, probability, outcomes!inner(label, delta_bps)")
      .in("outcome_id", outcomeIds)
      .gte("snapshot_at", since)
      .order("snapshot_at", { ascending: true });
    if (sErr || !snaps) return loadJsonHistory(meetingId, windowDays);

    const typedSnaps = snaps as unknown as HistoryRow[];

    // 3. Group by outcome_id
    const series: ProbabilitySeries[] = outcomes.map((o) => {
      const points = typedSnaps
        .filter((s) => s.outcome_id === o.id)
        .map((s) => ({
          snapshot_at: s.snapshot_at,
          probability: s.probability,
        }));
      return {
        outcome_id: o.id as string,
        label: o.label as string,
        delta_bps: o.delta_bps as number,
        series: points,
      };
    });

    if (series.every((s) => s.series.length === 0)) {
      return loadJsonHistory(meetingId, windowDays);
    }
    return series;
  } catch {
    return loadJsonHistory(meetingId, windowDays);
  }
}
