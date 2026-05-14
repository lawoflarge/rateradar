import { formatDelta } from "@/lib/movement";

interface Props {
  deltaPp: number;
  windowDays: number;
}

/**
 * Tiny inline indicator showing how an outcome's probability has moved
 * since `windowDays` ago. Up = stronger conviction for this outcome,
 * Down = fading conviction. We deliberately do not color by hawkish/dovish
 * tone, since "stronger Hold" and "stronger Cut" should look the same
 * structurally; the table row's outcome color already carries that meaning.
 */
export function MovementChip({ deltaPp, windowDays }: Props) {
  const { sign, label } = formatDelta(deltaPp);

  if (sign === "flat" || windowDays === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-ink-mute"
        title="No change since the previous snapshot"
      >
        <span aria-hidden>·</span>
        flat
      </span>
    );
  }

  const arrow = sign === "up" ? "▲" : "▼";
  const tone = sign === "up" ? "text-hold" : "text-cut";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tabular-nums text-[11px] ${tone}`}
      title={`Moved ${label} over ${windowDays}d`}
    >
      <span aria-hidden>{arrow}</span>
      {label}
    </span>
  );
}
