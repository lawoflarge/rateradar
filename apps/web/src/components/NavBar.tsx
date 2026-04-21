import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/compare", label: "Fed vs ECB" },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
  { href: "/brokers", label: "Brokers" },
  { href: "/about", label: "About" },
];

export function NavBar() {
  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div
            aria-hidden
            className="h-5 w-5 rounded-full border-2 border-emerald-400"
            style={{ boxShadow: "0 0 12px rgba(52, 211, 153, 0.5)" }}
          />
          <span className="text-sm font-semibold tracking-tight">RateRadar</span>
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
          {LINKS.filter((l) => l.href !== "/").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-emerald-400"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
