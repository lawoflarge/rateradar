import Link from "next/link";
import { BrandMark } from "./BrandMark";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/compare", label: "Fed vs ECB" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
  { href: "/brokers", label: "Brokers" },
  { href: "/about", label: "About" },
];

export function NavBar() {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink/15 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold tracking-tight text-ink">RateRadar</span>
        </Link>
        <div className="flex flex-wrap items-center gap-5 text-sm text-ink-soft">
          {LINKS.filter((l) => l.href !== "/").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-cut transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
