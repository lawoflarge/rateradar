import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — how RateRadar calculates probabilities",
  description:
    "Transparent, step-by-step methodology for deriving market-implied probabilities of Fed and ECB rate decisions from futures and OIS prices.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-4 text-lg text-zinc-400">
          How every probability on RateRadar is derived. If you can&apos;t trust the
          math, you can&apos;t trust the product.
        </p>
      </header>

      <article className="prose prose-invert prose-zinc max-w-none">
        <h2 className="text-2xl font-semibold">1. What we&apos;re computing</h2>
        <p className="text-zinc-300">
          For each upcoming FOMC (Fed) and ECB Governing Council meeting, we
          publish the market-implied probability of each possible rate outcome
          (hold, ±25 bps, ±50 bps, and larger moves when priced). We also
          publish conditional probabilities, an implied forward rate path, and
          daily historical snapshots that form a time series.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">2. Data sources</h2>
        <ul className="list-disc pl-6 text-zinc-300">
          <li>
            <strong>Fed:</strong> 30-Day Fed Funds Futures (symbol{" "}
            <code className="rounded bg-zinc-900 px-1">ZQ</code>), quoted on CME
            Globex. Pulled via free market-data providers; fallbacks include
            Stooq and FRED.
          </li>
          <li>
            <strong>ECB:</strong> €STR OIS (Overnight Index Swap) quotes by
            maturity. Derived implied rates are anchored to the published €STR
            fixing.
          </li>
          <li>
            <strong>Meeting calendars:</strong> sourced from{" "}
            <a
              href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
              className="text-emerald-400 hover:text-emerald-300"
            >
              federalreserve.gov
            </a>{" "}
            and{" "}
            <a
              href="https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"
              className="text-emerald-400 hover:text-emerald-300"
            >
              ecb.europa.eu
            </a>
            . Validated annually.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold">3. Futures → implied rate</h2>
        <p className="text-zinc-300">
          The Fed Funds Futures contract settles to the arithmetic average of
          daily effective Fed Funds rates during its contract month. The
          CME-standard transformation is:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-emerald-300">
{`implied_monthly_average_rate = 100 − contract_price`}
        </pre>
        <p className="text-zinc-300">
          For a month with a single FOMC meeting on day <em>d</em> of <em>N</em>{" "}
          days:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-emerald-300">
{`monthly_avg = (d/N) · r_before + ((N−d)/N) · r_after`}
        </pre>
        <p className="text-zinc-300">
          Solving for <em>r_after</em> from the observed monthly-average gives
          the market-implied post-meeting rate.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">
          4. Implied rate → outcome probabilities
        </h2>
        <p className="text-zinc-300">
          We use the CME&apos;s standard step-function decomposition. Given a
          finite set of possible outcomes with post-meeting rates{" "}
          {"{o₁, o₂, ..., oₖ}"} and the observed expected post-meeting rate{" "}
          <em>E[r]</em>, we distribute probability mass over the two outcomes
          adjacent to <em>E[r]</em> via linear interpolation, clamped and
          renormalized:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-emerald-300">
{`p_cut  = (r_hold − E[r]) / (r_hold − r_cut)
p_hold = 1 − p_cut`}
        </pre>
        <p className="text-zinc-300">
          Three+ outcomes extend the same principle using consecutive
          adjacent-pair decomposition.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">
          5. Update cadence
        </h2>
        <ul className="list-disc pl-6 text-zinc-300">
          <li>
            Daily snapshots: twice per business day (after US close and after
            European close).
          </li>
          <li>
            Meeting-day refreshes: every 15 minutes during the decision window.
          </li>
          <li>Historical retention: all snapshots kept indefinitely.</li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold">6. Validation</h2>
        <p className="text-zinc-300">
          Every snapshot is cross-checked against the live CME FedWatch page at
          capture time. Any outcome diverging more than 2% absolute triggers an
          alert. Weekly regression checks against CME&apos;s published historical
          archive catch long-term drift.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">7. Known MVP limitations</h2>
        <p className="text-zinc-300">
          The scaffold uses a single contract per meeting, which amplifies noise
          when the meeting falls within 5 days of the month-end. A Phase 2
          release will cross-anchor with adjacent contracts. See{" "}
          <code className="rounded bg-zinc-900 px-1">
            docs/METHODOLOGY.md §10
          </code>{" "}
          for details.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">8. Not financial advice</h2>
        <p className="text-zinc-300">
          RateRadar shows what the market is pricing. It doesn&apos;t predict what
          central banks will actually decide. Nothing here is a recommendation
          to trade, invest, or change your financial plans.
        </p>
      </article>
    </main>
  );
}
