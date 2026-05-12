import Link from "next/link";
import { HistoricalChart } from "./HistoricalChart";
import type { MeetingProbabilities, ProbabilitySeries } from "@/lib/types";

interface Props {
  data: MeetingProbabilities;
  history?: ProbabilitySeries[];
  showDetailLink?: boolean;
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

function actionTone(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("cut")) return "text-cut";
  if (l.includes("hike")) return "text-hike";
  if (l.includes("hold")) return "text-hold";
  return "text-ink";
}

function actionBarColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("cut")) return "bg-cut/60";
  if (l.includes("hike")) return "bg-hike/60";
  if (l.includes("hold")) return "bg-hold/60";
  return "bg-ink/40";
}

export function ProbabilityTable({ data, history, showDetailLink = true }: Props) {
  const topOutcome = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];

  return (
    <div className="space-y-4 rounded-none border border-ink/15 bg-cream-soft p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {formatMeetingDate(data.meeting.meeting_date)}
          </h3>
          <p className="text-sm text-ink-mute">
            FOMC meeting · {data.meeting.bank_code}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-ink-mute">Most likely</div>
          <div className={`text-lg font-semibold ${actionTone(topOutcome.label)}`}>
            <span className="font-mono tabular-nums">
              {topOutcome.label} · {(topOutcome.probability * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-ink/15">
        <table className="w-full text-sm">
          <thead className="bg-cream-soft">
            <tr className="text-left text-xs uppercase tracking-wide text-ink-mute">
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
                <tr key={o.id} className="border-b border-ink/10 last:border-b-0">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex font-mono text-xs font-medium tabular-nums ${actionTone(o.label)}`}
                    >
                      {o.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    <span className="font-mono tabular-nums font-medium">
                      {(o.probability * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-mute">
                    <span className="font-mono tabular-nums">
                      {o.post_meeting_rate.toFixed(3)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className={`h-1.5 rounded-full ${actionBarColor(o.label)}`}
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

      {showDetailLink && (
        <div className="flex justify-end">
          <Link
            href={`/meeting/${data.meeting.id}`}
            className="text-sm text-cut hover:text-cut"
          >
            View full details →
          </Link>
        </div>
      )}
    </div>
  );
}
