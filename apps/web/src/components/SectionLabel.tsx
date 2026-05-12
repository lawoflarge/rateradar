import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="small-caps text-xs font-medium text-ink-mute">{children}</div>
  );
}
