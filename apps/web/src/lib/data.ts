/**
 * Data-access layer for meeting probabilities.
 *
 * Tries Supabase first (if env vars are configured); falls back to built-in
 * mock data so dev / CI / first deploys never break. The fallback also covers
 * the "Supabase reachable but empty" case — handy before the pipeline runs.
 */

import { MOCK_FED_PROBABILITIES } from "./mock-data";
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
  const fallback = bankCode === "FED" ? MOCK_FED_PROBABILITIES : [];
  if (!hasSupabaseConfig()) return fallback;

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
      return fallback;
    }

    // 2. For each meeting, pull its outcomes + latest snapshot via the view
    const typedMeetings = meetings as unknown as MeetingRow[];
    const meetingIds = typedMeetings.map((m) => m.id);

    const { data: probs, error: pErr } = await supabase
      .from("latest_probabilities")
      .select("*")
      .in("meeting_id", meetingIds);

    if (pErr || !probs) {
      return fallback;
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

    // Filter to only meetings that have at least one non-zero probability — avoids
    // rendering empty rows when data hasn't flowed yet for a given meeting.
    const nonEmpty = result.filter((r) =>
      r.outcomes.some((o) => o.probability > 0),
    );
    return nonEmpty.length > 0 ? nonEmpty : fallback;
  } catch {
    return fallback;
  }
}

/** Backwards-compatible shortcut for FED. */
export const getFedProbabilities = (): Promise<MeetingProbabilities[]> =>
  getProbabilities("FED");

/** ECB counterpart. */
export const getEcbProbabilities = (): Promise<MeetingProbabilities[]> =>
  getProbabilities("ECB");

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
  if (!hasSupabaseConfig()) return [];

  try {
    const supabase = getSupabase();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Get all outcomes for this meeting (we need labels + delta_bps)
    const { data: outcomes, error: oErr } = await supabase
      .from("outcomes")
      .select("id, label, delta_bps")
      .eq("meeting_id", meetingId)
      .order("delta_bps", { ascending: true });
    if (oErr || !outcomes) return [];

    // 2. Get all snapshots for those outcomes in the window
    const outcomeIds = outcomes.map((o) => o.id as string);
    const { data: snaps, error: sErr } = await supabase
      .from("probability_snapshots")
      .select("outcome_id, snapshot_at, probability, outcomes!inner(label, delta_bps)")
      .in("outcome_id", outcomeIds)
      .gte("snapshot_at", since)
      .order("snapshot_at", { ascending: true });
    if (sErr || !snaps) return [];

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

    return series;
  } catch {
    return [];
  }
}
