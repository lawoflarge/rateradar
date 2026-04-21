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
      className="group flex-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 hover:border-emerald-400/60"
    >
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-100 group-hover:text-emerald-300">
        {formatShort(data.meeting.meeting_date)}
      </div>
      <div className="mt-2 text-sm text-zinc-400">
        <span className="font-mono text-zinc-200">{top.label}</span>
        <span className="mx-1 text-zinc-600">·</span>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
        Path context
      </div>
      <div className="flex flex-wrap gap-3">
        {prior ? (
          <MiniCard label="Prior meeting" data={prior} />
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-600">
            No earlier tracked meeting for this bank.
          </div>
        )}
        {next ? (
          <MiniCard label="Next meeting" data={next} />
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-600">
            No later tracked meeting for this bank.
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Market-implied probabilities chain meeting-to-meeting — today&apos;s odds
        already account for the most-likely outcome of prior meetings. See{" "}
        <Link
          href="/methodology"
          className="text-zinc-400 hover:text-emerald-400"
        >
          methodology
        </Link>{" "}
        for the full derivation.
      </p>
    </div>
  );
}
