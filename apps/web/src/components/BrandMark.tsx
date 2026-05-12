type Size = "sm" | "md";

export function BrandMark({ size = "md" }: { size?: Size }) {
  const px = size === "sm" ? 20 : 36;
  return (
    <svg
      role="img"
      aria-label="RateRadar"
      width={px}
      height={px}
      viewBox="0 0 36 36"
      className="text-ink"
    >
      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="18" cy="18" r="4" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <path
        d="M18 18 L31 12"
        stroke="var(--color-cut)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="31" cy="12" r="1.6" fill="var(--color-cut)" />
    </svg>
  );
}
