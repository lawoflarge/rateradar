import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glossary — rate-decision terms explained",
  description:
    "Plain-English definitions for the terms used on RateRadar: basis points, FOMC, DFR, hawkish, dovish, priced in, and more.",
  alternates: { canonical: "/glossary" },
};

const TERMS: { term: string; def: string }[] = [
  {
    term: "Basis point (bp / bps)",
    def: "One hundredth of a percent. A 25 bps rate cut moves the target rate down by 0.25 percentage points — e.g., from 4.50% to 4.25%.",
  },
  {
    term: "FOMC",
    def: "Federal Open Market Committee — the 12-member body at the Federal Reserve that sets the US policy interest rate. Meets 8 times per year.",
  },
  {
    term: "Fed Funds Target Rate",
    def: "The interest rate the Fed targets for overnight lending between banks. Published as a 25-bp-wide range (e.g., 4.25–4.50%). The midpoint is what we use as the anchor for probability calculations.",
  },
  {
    term: "Deposit Facility Rate (DFR)",
    def: "The interest rate the ECB pays on overnight deposits from banks. Since 2023, the operational 'policy rate' for markets — what our ECB probabilities track.",
  },
  {
    term: "€STR",
    def: "Euro Short-Term Rate — the reference overnight rate in the eurozone, published by the ECB. Closely tracks the DFR (typically ~5-10 bps below).",
  },
  {
    term: "OIS (Overnight Index Swap)",
    def: "A swap contract where one side pays a fixed rate and the other pays the geometric average of an overnight rate (€STR for Europe, SOFR for the US). OIS curves are how markets price future central-bank policy.",
  },
  {
    term: "Fed Funds Futures",
    def: "CME-traded futures contracts that settle to the monthly average of the daily effective Fed Funds rate. The source of Fed probability calculations — each contract month's price implies the market's average expected rate for that month.",
  },
  {
    term: "Priced in",
    def: "When markets have already adjusted futures prices to reflect an expected outcome, that outcome is 'priced in'. Actual moves that are fully priced in tend not to move asset prices much; surprises do.",
  },
  {
    term: "Hawkish / Dovish",
    def: "Hawkish = inclined toward higher rates (tighter policy) to fight inflation. Dovish = inclined toward lower rates (easier policy) to support growth. Describes both central bank officials and market sentiment.",
  },
  {
    term: "Terminal rate",
    def: "The market's expected peak (or trough) policy rate over a cycle. RateRadar's forward rate curve shows the market-implied path toward the current terminal.",
  },
  {
    term: "Conditional probability",
    def: "The probability of an outcome at a future meeting GIVEN a specific outcome at an earlier meeting. Example: 'If the Fed cuts 25 bps in June, what's the probability of another cut in July?'",
  },
  {
    term: "Implied rate path",
    def: "The sequence of market-expected policy rates at each future meeting, derived by chaining per-meeting expected changes. The forward curve on RateRadar visualizes this.",
  },
  {
    term: "Cumulative pricing",
    def: "The total expected change in the policy rate across all upcoming meetings in a window. For example, '-65 bps priced in by December' means markets expect roughly 2-3 cuts of 25 bps each by year-end.",
  },
];

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Glossary</h1>
        <p className="mt-4 text-lg text-zinc-400">
          Plain-English definitions for the terms you&apos;ll see on RateRadar.
          No Bloomberg terminal required.
        </p>
      </header>

      <dl className="space-y-8">
        {TERMS.map(({ term, def }) => (
          <div
            key={term}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6"
          >
            <dt className="text-lg font-semibold text-zinc-100">{term}</dt>
            <dd className="mt-2 text-zinc-400">{def}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
