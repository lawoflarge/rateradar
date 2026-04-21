import type { Metadata } from "next";
import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { getEcbProbabilities, getFedProbabilities } from "@/lib/data";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Fed vs ECB — divergence in rate-cut pricing",
  description:
    "Side-by-side market-implied probabilities and forward rate paths for the Federal Reserve and the European Central Bank. Track divergence in real time.",
  openGraph: {
    title: "Fed vs ECB — divergence in rate-cut pricing",
    description:
      "Side-by-side market-implied probabilities and forward rate paths for the Fed and the ECB.",
    type: "website",
  },
  alternates: { canonical: "/compare" },
};

function cumulative(snapshots: ReturnType<typeof sumExpected>): number {
  return snapshots;
}

function sumExpected(s: { outcomes: { probability: number; delta_bps: number }[] }[]) {
  return s.reduce(
    (acc, m) => acc + m.outcomes.reduce((a, o) => a + o.probability * o.delta_bps, 0),
    0,
  );
}

export default async function ComparePage() {
  const [fed, ecb] = await Promise.all([
    getFedProbabilities(),
    getEcbProbabilities(),
  ]);

  const fedCumBps = cumulative(sumExpected(fed));
  const ecbCumBps = cumulative(sumExpected(ecb));
  const divergenceBps = fedCumBps - ecbCumBps;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight">Fed vs ECB</h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-400">
          Compare market-implied probabilities and forward rate paths for the
          Federal Reserve and the European Central Bank. A growing divergence
          often signals shifting global macro expectations.
        </p>
      </header>

      {/* Divergence headline */}
      <section className="mb-12 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Fed pricing
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-emerald-300">
            {fedCumBps >= 0 ? "+" : ""}
            {fedCumBps.toFixed(0)} bps
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            cumulative expected change
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            ECB pricing
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-emerald-300">
            {ecbCumBps >= 0 ? "+" : ""}
            {ecbCumBps.toFixed(0)} bps
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            cumulative expected change
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-emerald-950/30 to-zinc-950 p-5">
          <div className="text-xs uppercase tracking-wide text-emerald-400">
            Divergence (Fed − ECB)
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-emerald-300">
            {divergenceBps >= 0 ? "+" : ""}
            {divergenceBps.toFixed(0)} bps
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {divergenceBps < 0
              ? "Fed is priced more dovishly than ECB"
              : divergenceBps > 0
                ? "Fed is priced more hawkishly than ECB"
                : "Both banks priced equally"}
          </div>
        </div>
      </section>

      {/* Paths */}
      <section className="mb-12 space-y-6">
        <MostLikelyPath snapshots={fed} label="Fed most-likely path" />
        <MostLikelyPath snapshots={ecb} label="ECB most-likely path" />
      </section>

      {/* Implied rate curves side by side */}
      <section className="mb-12 grid gap-6 md:grid-cols-2">
        <ImpliedRateCurve
          snapshots={fed}
          startingRate={CURRENT_POLICY_RATES.FED}
          bankLabel="Federal Reserve"
        />
        <ImpliedRateCurve
          snapshots={ecb}
          startingRate={CURRENT_POLICY_RATES.ECB}
          bankLabel="European Central Bank"
        />
      </section>

      <footer className="border-t border-zinc-900 pt-8 text-sm text-zinc-500">
        <p>
          Cumulative expected change = Σ (p<sub>i</sub> × Δ<sub>i</sub>) over all
          upcoming meetings. Positive = rate hikes priced in; negative = cuts.
          See{" "}
          <a href="/methodology" className="text-zinc-300 hover:text-emerald-400">
            methodology
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
