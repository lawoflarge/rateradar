import type { Metadata } from "next";
import { Rule } from "@/components/Rule";

export const metadata: Metadata = {
  title: "Brokers — trade rate-sensitive instruments",
  description:
    "Broker partnerships for trading Fed Funds Futures, Treasuries, and rate-sensitive ETFs. Transparent affiliate partnerships that keep RateRadar free.",
  alternates: { canonical: "/brokers" },
};

// Placeholders — real affiliate URLs + creatives to be wired once partner
// programs are approved. Keeping this page live pre-partnership for SEO
// ("rateradar brokers") and so we can iterate copy while waiting for approvals.
const BROKERS = [
  {
    slug: "interactive-brokers",
    name: "Interactive Brokers",
    tagline: "Global pro-grade access to Fed Funds Futures, Treasuries, and OIS.",
    markets: ["US", "EU", "UK", "Global"],
    notes: "Best for active traders; low commissions, deep instrument coverage.",
  },
  {
    slug: "trading212",
    name: "Trading 212",
    tagline: "Commission-free equity + ETF investing for retail Europe.",
    markets: ["EU", "UK"],
    notes: "Good for macro-themed ETFs (TLT equivalents). No futures.",
  },
  {
    slug: "etoro",
    name: "eToro",
    tagline: "Social trading with CFD access to rate-sensitive pairs.",
    markets: ["EU", "UK", "Global"],
    notes: "CFDs only — good for EUR/USD moves around ECB/Fed decisions.",
  },
  {
    slug: "plus500",
    name: "Plus500",
    tagline: "CFD trading on bond futures and currency pairs.",
    markets: ["EU", "UK", "Global"],
    notes: "CFDs; high-risk. Check regional availability.",
  },
];

export default function BrokersPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
          Trade what you see
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          RateRadar is free because of transparent broker partnerships. These are
          reputable, regulated brokers where you can act on the rate-expectation
          shifts this site surfaces.
        </p>
      </header>

      <div className="mb-10 border-y border-cut/40 bg-cut/10 px-5 py-4 text-sm text-ink-soft">
        <strong className="text-ink">Partnership status:</strong> approvals in
        progress. Links below are placeholders until affiliate IDs are live. This
        is not financial advice; trade at your own risk and verify regulation in
        your region.
      </div>

      <Rule />

      <div>
        {BROKERS.map((b, i) => (
          <article key={b.slug} className="py-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl font-medium text-ink">
                {b.name}
              </h2>
              <div className="flex gap-1">
                {b.markets.map((m) => (
                  <span
                    key={m}
                    className="border border-ink/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-mute"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-lg leading-relaxed text-ink-soft">
              {b.tagline}
            </p>
            <p className="mt-2 text-sm text-ink-mute">{b.notes}</p>
            <div className="mt-4">
              <span className="text-cut hover:text-ink underline-offset-4 hover:underline">
                Link coming soon →
              </span>
            </div>
            {i < BROKERS.length - 1 && (
              <div className="mt-8">
                <Rule tone="soft" />
              </div>
            )}
          </article>
        ))}
      </div>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          Links on this page will be affiliate links once programs are approved.
          RateRadar may receive a commission if you sign up, at no cost to you.
          We only partner with regulated brokers we would use ourselves.
        </p>
      </footer>
    </main>
  );
}
