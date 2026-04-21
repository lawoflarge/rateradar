import Link from "next/link";
import type { MeetingProbabilities } from "@/lib/types";

interface Props {
  snapshots: MeetingProbabilities[];
  label?: string;
  maxMeetings?: number;
}

function topOutcome(s: MeetingProbabilities) {
  return [...s.outcomes].sort((a, b) => b.probability - a.probability)[0];
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function outcomeColor(delta: number, probability: number): string {
  const strong = probability >= 0.5;
  if (delta < 0) return strong ? "border-emerald-400 text-emerald-300" : "border-emerald-500/40 text-emerald-400/70";
  if (delta > 0) return strong ? "border-red-400 text-red-300" : "border-red-500/40 text-red-400/70";
  return strong ? "border-blue-400 text-blue-300" : "border-blue-500/40 text-blue-400/70";
}

export function MostLikelyPath({
  snapshots,
  label = "Most-likely path",
  maxMeetings = 8,
}: Props) {
  if (snapshots.length === 0) return null;

  const list = snapshots.slice(0, maxMeetings);

  // Running total of expected bps change (not the same as most-likely — this is
  // the expectation over all outcomes, shown as a "cumulative pricing" metric)
  let cumulativeExpectedBps = 0;
  const withExpected = list.map((s) => {
    const expectedDelta = s.outcomes.reduce(
      (acc, o) => acc + o.probability * o.delta_bps,
      0,
    );
    cumulativeExpectedBps += expectedDelta;
    return { snapshot: s, expectedDelta, cumulative: cumulativeExpectedBps };
  });

  const finalCumulative = withExpected[withExpected.length - 1]?.cumulative ?? 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {label}
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            Most-likely outcome at each upcoming meeting, chained in order.
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Cumulative pricing
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
            {finalCumulative >= 0 ? "+" : ""}
            {finalCumulative.toFixed(0)} bps by{" "}
            {formatShort(
              withExpected[withExpected.length - 1].snapshot.meeting.meeting_date,
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {withExpected.map(({ snapshot, cumulative }, i) => {
          const top = topOutcome(snapshot);
          const cls = outcomeColor(top.delta_bps, top.probability);
          const showChevron = i < withExpected.length - 1;
          return (
            <div key={snapshot.meeting.id} className="flex items-center">
              <Link
                href={`/meeting/${snapshot.meeting.id}`}
                className={`flex w-[104px] flex-col items-center rounded-lg border bg-zinc-900/60 px-3 py-3 text-center transition-colors hover:border-emerald-400 ${cls}`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-80">
                  {snapshot.meeting.bank_code}
                </div>
                <div className="mt-0.5 text-xs font-medium text-zinc-200">
                  {formatShort(snapshot.meeting.meeting_date)}
                </div>
                <div className="mt-2 text-sm font-semibold tabular-nums">
                  {top.label}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                  {(top.probability * 100).toFixed(0)}%
                </div>
                <div className="mt-2 text-[10px] text-zinc-500 tabular-nums">
                  Σ {cumulative >= 0 ? "+" : ""}
                  {cumulative.toFixed(0)}bp
                </div>
              </Link>
              {showChevron && (
                <div aria-hidden className="px-1 text-zinc-700">
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
