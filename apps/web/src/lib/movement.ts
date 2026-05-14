/**
 * Movement helpers for the probability tables.
 *
 * "Movement" is how an outcome's probability has shifted over a recent
 * window. We surface it inline so the historical-tracking value prop shows
 * on first paint, not only after the reader scrolls to the history chart.
 */

import type { ProbabilitySeries } from "./types";

export interface OutcomeMovement {
  /** Probability change in percentage points (current minus baseline). */
  deltaPp: number;
  /** Days the baseline is from (informational; clamped to available data). */
  windowDays: number;
  /** Baseline probability used for the comparison. */
  baselineProbability: number;
}

export interface Movements {
  windowDays: number;
  byLabel: Record<string, OutcomeMovement>;
}

function pickBaseline(
  series: ProbabilitySeries["series"],
  windowDays: number,
): { probability: number; actualWindowDays: number } | null {
  if (series.length === 0) return null;
  if (series.length === 1) {
    return { probability: series[0].probability, actualWindowDays: 0 };
  }

  const sorted = [...series].sort((a, b) =>
    a.snapshot_at < b.snapshot_at ? -1 : 1,
  );
  const latestAt = new Date(sorted[sorted.length - 1].snapshot_at).getTime();
  const cutoff = latestAt - windowDays * 24 * 60 * 60 * 1000;

  const onOrBefore = sorted.filter(
    (p) => new Date(p.snapshot_at).getTime() <= cutoff,
  );
  const baselinePoint =
    onOrBefore.length > 0 ? onOrBefore[onOrBefore.length - 1] : sorted[0];

  const actualMs = latestAt - new Date(baselinePoint.snapshot_at).getTime();
  return {
    probability: baselinePoint.probability,
    actualWindowDays: Math.round(actualMs / (24 * 60 * 60 * 1000)),
  };
}

export function computeMovements(
  history: ProbabilitySeries[] | undefined,
  windowDays = 7,
): Movements | null {
  if (!history || history.length === 0) return null;

  const byLabel: Record<string, OutcomeMovement> = {};
  let maxActualWindow = 0;
  for (const s of history) {
    if (s.series.length === 0) continue;
    const latest = [...s.series].sort((a, b) =>
      a.snapshot_at < b.snapshot_at ? -1 : 1,
    )[s.series.length - 1];
    const baseline = pickBaseline(s.series, windowDays);
    if (!baseline) continue;
    byLabel[s.label] = {
      deltaPp: (latest.probability - baseline.probability) * 100,
      windowDays: baseline.actualWindowDays,
      baselineProbability: baseline.probability,
    };
    maxActualWindow = Math.max(maxActualWindow, baseline.actualWindowDays);
  }

  if (Object.keys(byLabel).length === 0) return null;
  return { windowDays: maxActualWindow || windowDays, byLabel };
}

/**
 * Tone for a probability move. A move toward an outcome (positive delta) is
 * "stronger" for that outcome; negative is "weaker". The arrow direction is
 * always tied to the sign, regardless of whether the outcome itself is
 * hawkish or dovish.
 */
export function formatDelta(deltaPp: number): {
  sign: "up" | "down" | "flat";
  label: string;
} {
  const rounded = Math.round(deltaPp * 10) / 10;
  if (rounded === 0) return { sign: "flat", label: "0.0pp" };
  if (rounded > 0) return { sign: "up", label: `+${rounded.toFixed(1)}pp` };
  return { sign: "down", label: `${rounded.toFixed(1)}pp` };
}
