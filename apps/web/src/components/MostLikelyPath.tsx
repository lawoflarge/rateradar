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
  if (delta < 0) return strong ? "border-cut text-cut" : "border-ink/25 text-cut/70";
  if (delta > 0) return strong ? "border-hike text-hike" : "border-ink/25 text-hike/70";
  return strong ? "border-hold text-hold" : "border-ink/25 text-hold/70";
}

export function MostLikelyPath({
  snapshots,
  label = "Most-likely path",
  maxMeetings = 8,
}: Props) {
  if (snapshots.length === 0) return null;

  const list = snapshots.slice(0, maxMeetings);

  // Running total of expected bps change. Use reduce instead of a mutable
  // `let` accumulator — React 19's purity rule flags reassignment during render.
  type PathEntry = {
    snapshot: (typeof list)[number];
    expectedDelta: number;
    cumulative: number;
  };
  const withExpected: PathEntry[] = list.reduce<PathEntry[]>((acc, s) => {
    const expectedDelta = s.outcomes.reduce(
      (a, o) => a + o.probability * o.delta_bps,
      0,
    );
    const prevCumulative = acc.length === 0 ? 0 : acc[acc.length - 1].cumulative;
    return [
      ...acc,
      { snapshot: s, expectedDelta, cumulative: prevCumulative + expectedDelta },
    ];
  }, []);

  const finalCumulative = withExpected[withExpected.length - 1]?.cumulative ?? 0;

  return (
    <div className="rounded-none border border-ink/15 bg-cream-soft p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-mute">
            {label}
          </div>
          <div className="mt-1 text-sm text-ink-mute">
            Most-likely outcome at each upcoming meeting, chained in order.
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-ink-mute">
            Cumulative pricing
          </div>
          <div className="mt-1 text-lg font-mono tabular-nums font-semibold text-cut">
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
                className={`flex w-[104px] flex-col items-center rounded-lg border bg-cream-soft px-3 py-3 text-center transition-colors hover:border-cut ${cls}`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-80">
                  {snapshot.meeting.bank_code}
                </div>
                <div className="mt-0.5 text-xs font-medium text-ink">
                  {formatShort(snapshot.meeting.meeting_date)}
                </div>
                <div className="mt-2 text-sm font-mono font-semibold tabular-nums">
                  {top.label}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-mute font-mono tabular-nums">
                  {(top.probability * 100).toFixed(0)}%
                </div>
                <div className="mt-2 text-[10px] text-ink-mute font-mono tabular-nums">
                  Σ {cumulative >= 0 ? "+" : ""}
                  {cumulative.toFixed(0)}bp
                </div>
              </Link>
              {showChevron && (
                <div aria-hidden className="px-1 text-ink/25">
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
