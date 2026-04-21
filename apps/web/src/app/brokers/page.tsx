import type { Metadata } from "next";

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
        <h1 className="text-4xl font-semibold tracking-tight">Trade what you see</h1>
        <p className="mt-4 text-lg text-zinc-400">
          RateRadar is free because of transparent broker partnerships. These are
          reputable, regulated brokers where you can act on the rate-expectation
          shifts this site surfaces.
        </p>
      </header>

      <div className="mb-10 rounded-xl border border-amber-900/40 bg-amber-950/20 p-5 text-sm text-amber-200">
        <strong>Partnership status:</strong> approvals in progress. Links below
        are placeholders until affiliate IDs are live. This is not financial
        advice; trade at your own risk and verify regulation in your region.
      </div>

      <div className="space-y-6">
        {BROKERS.map((b) => (
          <article
            key={b.slug}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">{b.name}</h2>
              <div className="flex gap-1">
                {b.markets.map((m) => (
                  <span
                    key={m}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-zinc-300">{b.tagline}</p>
            <p className="mt-2 text-sm text-zinc-500">{b.notes}</p>
            <div className="mt-4 inline-flex rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
              Link coming soon
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-12 text-sm text-zinc-500">
        <p>
          Links on this page will be affiliate links once programs are approved.
          RateRadar may receive a commission if you sign up, at no cost to you.
          We only partner with regulated brokers we would use ourselves.
        </p>
      </footer>
    </main>
  );
}
