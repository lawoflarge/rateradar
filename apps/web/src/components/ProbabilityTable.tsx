import { HistoricalChart } from "./HistoricalChart";
import type { MeetingProbabilities, ProbabilitySeries } from "@/lib/types";

interface Props {
  data: MeetingProbabilities;
  history?: ProbabilitySeries[];
}

function formatMeetingDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function probabilityColor(p: number): string {
  // Warmer tones = higher probability
  if (p >= 0.5) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (p >= 0.2) return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  if (p >= 0.05) return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  return "bg-zinc-900 text-zinc-600 border-zinc-800";
}

export function ProbabilityTable({ data, history }: Props) {
  const topOutcome = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">
            {formatMeetingDate(data.meeting.meeting_date)}
          </h3>
          <p className="text-sm text-zinc-500">
            FOMC meeting · {data.meeting.bank_code}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Most likely</div>
          <div className="text-lg font-semibold text-emerald-300">
            {topOutcome.label} · {(topOutcome.probability * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3 text-right">Probability</th>
              <th className="px-4 py-3 text-right">Post-meeting rate</th>
              <th className="px-4 py-3" aria-label="probability bar" />
            </tr>
          </thead>
          <tbody>
            {data.outcomes.map((o) => {
              const barWidth = Math.max(o.probability * 100, 0.5);
              return (
                <tr key={o.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums ${probabilityColor(o.probability)}`}
                    >
                      {o.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    {(o.probability * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">
                    {o.post_meeting_rate.toFixed(3)}%
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400/60"
                      style={{ width: `${barWidth}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HistoricalChart
        meetingId={data.meeting.id}
        windowDays={60}
        initialSeries={history}
      />
    </div>
  );
}
