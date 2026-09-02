import Link from "next/link";
import { AppStoreBadge } from "./AppStoreBadge";

/**
 * Global footer. Two jobs: put the App Store badge on every page, since every
 * page is a landing page for somebody arriving from search, and give the
 * keyword pages a permanent internal link from the whole site.
 */

const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Live tracking",
    links: [
      { href: "/fed", label: "Next Fed meeting" },
      { href: "/ecb", label: "Next ECB meeting" },
      { href: "/compare", label: "Fed vs ECB" },
      { href: "/scenarios", label: "Rate scenarios" },
    ],
  },
  {
    title: "iPhone app",
    links: [
      { href: "/fed-rate-tracker-app", label: "Fed rate tracker app" },
      { href: "/rate-cut-alerts", label: "Rate cut alerts" },
      { href: "/cme-fedwatch-alternative", label: "CME FedWatch alternative" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: "/methodology", label: "Methodology" },
      { href: "/glossary", label: "Glossary" },
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink/15 bg-cream-soft">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-serif text-lg font-medium text-ink">
              Track Fed and ECB odds on your iPhone
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
              Free, no account, no in-app purchases. Requires iOS 17 or later.
            </p>
            <div className="mt-4">
              <AppStoreBadge slug="footer" />
            </div>
          </div>

          {SECTIONS.map((s) => (
            <nav key={s.title} aria-label={s.title}>
              <h2 className="font-mono text-xs uppercase tracking-wider text-ink-mute">
                {s.title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-ink-soft underline-offset-4 transition-colors hover:text-cut hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-ink/10 pt-6 text-xs leading-relaxed text-ink-mute">
          Probabilities are computed in house from 30 Day Fed Funds Futures and
          euro short-term rate data, then refreshed twice per business day. They
          describe what the market is pricing, not what a central bank will
          decide. RateRadar is informational and is not financial advice.
        </p>
      </div>
    </footer>
  );
}
