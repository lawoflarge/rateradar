import type { MeetingProbabilities } from "@/lib/types";

export interface ConditionalScenario {
  startingRate: number; // the chosen outcome's post_meeting_rate (percent)
  after: MeetingProbabilities[]; // meetings strictly after the conditioned one
  anchorLabel: string; // e.g. "Mar 18: -25bp"
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Deterministic re-anchoring: condition on "meeting `meetingId` resolves to
 * outcome `outcomeId`". Returns the rate to anchor from (that outcome's
 * post-meeting rate) plus the meetings strictly after it, whose unconditional
 * expected deltas are then chained from the anchor by the caller.
 *
 * This is an explicit independence assumption (the after-meetings' market
 * distributions are unchanged) — a what-if, not a forecast.
 *
 * Returns null when the meeting or outcome is not found, or when the
 * conditioned meeting is the last one (no subsequent path to project).
 */
export function buildConditional(
  snapshots: MeetingProbabilities[],
  meetingId: string,
  outcomeId: string,
): ConditionalScenario | null {
  const idx = snapshots.findIndex((s) => s.meeting.id === meetingId);
  if (idx === -1) return null;

  const outcome = snapshots[idx].outcomes.find((o) => o.id === outcomeId);
  if (!outcome) return null;

  const after = snapshots.slice(idx + 1);
  if (after.length === 0) return null;

  return {
    startingRate: outcome.post_meeting_rate,
    after,
    anchorLabel: `${formatShort(snapshots[idx].meeting.meeting_date)}: ${outcome.label}`,
  };
}
