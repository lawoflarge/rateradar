import Link from "next/link";

interface Props {
  version: string;
  /** ISO timestamp of the most recent snapshot, if known. */
  snapshotAt?: string | null;
  /** Source: "supabase" when the DB returned data, "json" when reading from
   *  the git-committed JSON snapshots. Surfaced as a tiny dot for trust. */
  source?: "supabase" | "json" | "mock";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * Visible trust signal: methodology version + last calculation time.
 * The whole chip links to /methodology so curious readers can audit the math.
 */
export function MethodologyBadge({ version, snapshotAt, source }: Props) {
  return (
    <Link
      href="/methodology"
      className="inline-flex items-center gap-2 border border-ink/15 bg-cream-soft px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute transition-colors hover:border-cut/40 hover:text-ink"
      title="View the open methodology"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-cut" />
      <span>methodology v{version}</span>
      {snapshotAt && (
        <>
          <span aria-hidden className="text-ink-mute/50">·</span>
          <span>{relativeTime(snapshotAt)}</span>
        </>
      )}
      {source && source !== "supabase" && (
        <>
          <span aria-hidden className="text-ink-mute/50">·</span>
          <span title={source === "json" ? "Read from git-tracked JSON snapshot" : "Sample data"}>
            {source === "json" ? "git" : "sample"}
          </span>
        </>
      )}
    </Link>
  );
}
