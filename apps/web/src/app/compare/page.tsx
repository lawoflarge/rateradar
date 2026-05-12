import type { Metadata } from "next";
import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
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
        <SectionLabel>Divergence tracker</SectionLabel>
        <h1 className="mt-4 font-serif text-5xl font-medium tracking-tight text-ink sm:text-6xl">
          Fed vs ECB
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Compare market-implied probabilities and forward rate paths for the
          Federal Reserve and the European Central Bank. A growing divergence
          often signals shifting global macro expectations.
        </p>
      </header>

      <Rule />

      {/* Divergence headline: rule-separated columns, no cards */}
      <section className="my-12 grid gap-8 border-y border-ink/15 py-8 md:grid-cols-3">
        <div>
          <SectionLabel>Fed pricing</SectionLabel>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">
            <span className="font-mono tabular-nums">
              {fedCumBps >= 0 ? "+" : ""}
              {fedCumBps.toFixed(0)}
            </span>{" "}
            bps
          </div>
          <div className="mt-1 text-sm text-ink-mute">
            cumulative expected change
          </div>
        </div>
        <div className="md:border-l md:border-ink/15 md:pl-8">
          <SectionLabel>ECB pricing</SectionLabel>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">
            <span className="font-mono tabular-nums">
              {ecbCumBps >= 0 ? "+" : ""}
              {ecbCumBps.toFixed(0)}
            </span>{" "}
            bps
          </div>
          <div className="mt-1 text-sm text-ink-mute">
            cumulative expected change
          </div>
        </div>
        <div className="md:border-l md:border-ink/15 md:pl-8">
          <SectionLabel>Divergence (Fed − ECB)</SectionLabel>
          <div className="mt-2 font-serif text-3xl font-medium text-cut">
            <span className="font-mono tabular-nums">
              {divergenceBps >= 0 ? "+" : ""}
              {divergenceBps.toFixed(0)}
            </span>{" "}
            bps
          </div>
          <div className="mt-1 text-sm text-ink-mute">
            {divergenceBps < 0
              ? "Fed is priced more dovishly than ECB"
              : divergenceBps > 0
                ? "Fed is priced more hawkishly than ECB"
                : "Both banks priced equally"}
          </div>
        </div>
      </section>

      <Rule tone="soft" />

      {/* Paths */}
      <section className="my-12">
        <SectionLabel>Most-likely paths</SectionLabel>
        <h2 className="mt-2 mb-6 font-serif text-2xl font-medium text-ink">
          Cumulative expected changes by meeting
        </h2>
        <div className="space-y-8">
          <MostLikelyPath snapshots={fed} label="Fed most-likely path" />
          <MostLikelyPath snapshots={ecb} label="ECB most-likely path" />
        </div>
      </section>

      <Rule tone="soft" />

      {/* Implied rate curves side by side */}
      <section className="my-12">
        <SectionLabel>Implied rate curves</SectionLabel>
        <h2 className="mt-2 mb-6 font-serif text-2xl font-medium text-ink">
          Forward path side by side
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <ImpliedRateCurve
              snapshots={fed}
              startingRate={CURRENT_POLICY_RATES.FED}
              bankLabel="Federal Reserve"
            />
          </div>
          <div className="md:border-l md:border-ink/15 md:pl-8">
            <ImpliedRateCurve
              snapshots={ecb}
              startingRate={CURRENT_POLICY_RATES.ECB}
              bankLabel="European Central Bank"
            />
          </div>
        </div>
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          Cumulative expected change = Σ (p<sub>i</sub> × Δ<sub>i</sub>) over all
          upcoming meetings. Positive = rate hikes priced in; negative = cuts.
          See{" "}
          <a
            href="/methodology"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            methodology
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
