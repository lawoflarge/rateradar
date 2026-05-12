export function Rule({ tone = "ink" }: { tone?: "ink" | "soft" }) {
  return (
    <hr
      aria-hidden
      className={tone === "ink" ? "border-t border-ink/80" : "border-t border-rule-soft"}
    />
  );
}
