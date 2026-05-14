import Link from "next/link";
import type { MeetingProbabilities } from "@/lib/types";

interface Props {
  prior: MeetingProbabilities | null;
  next: MeetingProbabilities | null;
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function topOutcome(m: MeetingProbabilities) {
  return [...m.outcomes].sort((a, b) => b.probability - a.probability)[0];
}

function MiniCard({
  label,
  data,
}: {
  label: string;
  data: MeetingProbabilities;
}) {
  const top = topOutcome(data);
  return (
    <Link
      href={`/meeting/${data.meeting.id}`}
      className="group flex-1 rounded-none border border-ink/15 bg-cream-soft p-5 hover:border-cut"
    >
      <div className="text-xs uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink group-hover:text-cut">
        {formatShort(data.meeting.meeting_date)}
      </div>
      <div className="mt-2 text-sm text-ink-mute">
        <span className="font-mono tabular-nums text-ink">{top.label}</span>
        <span className="mx-1 text-ink-mute">·</span>
        <span className="font-mono tabular-nums">
          {(top.probability * 100).toFixed(0)}%
        </span>
      </div>
    </Link>
  );
}

export function MeetingContext({ prior, next }: Props) {
  if (!prior && !next) return null;

  return (
    <div className="rounded-none border border-ink/15 bg-cream-soft p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-ink-mute">
        Path context
      </div>
      <div className="flex flex-wrap gap-3">
        {prior ? (
          <MiniCard label="Prior meeting" data={prior} />
        ) : (
          <div className="flex-1 rounded-none border border-dashed border-ink/15 p-5 text-sm text-ink-mute">
            No earlier tracked meeting for this bank.
          </div>
        )}
        {next ? (
          <MiniCard label="Next meeting" data={next} />
        ) : (
          <div className="flex-1 rounded-none border border-dashed border-ink/15 p-5 text-sm text-ink-mute">
            No later tracked meeting for this bank.
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-mute">
        Market-implied probabilities chain meeting-to-meeting. Today&apos;s odds
        already account for the most-likely outcome of prior meetings. See{" "}
        <Link
          href="/methodology"
          className="text-ink-soft hover:text-cut"
        >
          methodology
        </Link>{" "}
        for the full derivation.
      </p>
    </div>
  );
}
