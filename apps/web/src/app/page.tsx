import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { MethodologyBadge } from "@/components/MethodologyBadge";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import {
  getEcbProbabilities,
  getFedProbabilities,
  getMeetingHistory,
} from "@/lib/data";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";
import { loadJsonSnapshotAt } from "@/lib/snapshots";
import type { MeetingProbabilities, ProbabilitySeries } from "@/lib/types";

const GEO_DEFINITION =
  "RateRadar is a free iPhone app that tracks the U.S. federal funds rate and the market-implied probability of every upcoming Federal Reserve (FOMC) and European Central Bank rate decision. It computes its own odds from 30-Day Fed Funds Futures and €STR OIS data, never scraped, and keeps 60 days of probability history.";

/** The App Store posters, web-optimized. Alt text describes what is actually
    on each screen, not what we wish it showed. */
const SHOTS = [
  {
    src: "/shots/01.webp",
    alt: "RateRadar dashboard on iPhone showing the next Federal Reserve decision and the current market-implied odds.",
  },
  {
    src: "/shots/02.webp",
    alt: "Outcome distribution screen asking whether the Fed will cut rates on December 9, 2026, with hold at 64 percent as the most likely outcome.",
  },
  {
    src: "/shots/03.webp",
    alt: "Per-meeting probability table for an FOMC meeting with a 60-day probability history chart underneath.",
  },
  {
    src: "/shots/04.webp",
    alt: "Alerts settings screen with meeting reminders and rate shift alerts, and a sharp move threshold set to 8 percentage points.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is there a free app to track the Fed interest rate?",
    a: "Yes. RateRadar is a free iPhone app that tracks the U.S. federal funds rate and the market-implied odds of every upcoming Federal Reserve decision. It shows whether markets expect a hold, cut, or hike, the most likely rate path, and 60 days of how those odds moved. No account is required.",
  },
  {
    q: "Where does RateRadar get its rate data?",
    a: "RateRadar computes its own probabilities in-house from 30-Day Fed Funds Futures and €STR OIS quotes, using the public CME step-function methodology. It never scrapes CME FedWatch or ECB Watch. Every number is derived from free market prices, and the full method is documented on the app's methodology page.",
  },
  {
    q: "When is the next FOMC meeting?",
    a: "The FOMC is the Federal Reserve committee that sets U.S. interest rates, and it meets eight times a year. RateRadar always shows the next scheduled meeting with a live countdown, the market-implied probability of a hold, cut, or hike, and the current policy rate, so you never have to look up the calendar.",
  },
  {
    q: "Does RateRadar track the European Central Bank too?",
    a: "Yes. Alongside the Federal Reserve, RateRadar tracks market-implied probabilities for every upcoming European Central Bank rate decision. It shows the ECB's most likely path, the implied forward rate curve, and a side-by-side Fed-versus-ECB divergence view, so you can see where the two central banks are expected to move apart.",
  },
  {
    q: "What does market-implied probability mean?",
    a: "A market-implied probability is the chance of a rate outcome inferred from the prices traders pay for interest-rate futures, not a forecast or opinion. RateRadar derives these odds from Fed Funds Futures and €STR OIS using the published CME method, then tracks how they shift daily into each meeting. It is not financial advice.",
  },
  {
    q: "Can I see how rate expectations changed over time?",
    a: "Yes. Historical tracking is RateRadar's core feature. It saves the probability of each outcome daily and keeps 60 days of history per meeting, so you can see how the odds of a cut, hold, or hike shifted week by week, not just today's snapshot. Sharp-move alerts flag big changes.",
  },
  {
    q: "Is RateRadar free, and does it have in-app purchases?",
    a: "RateRadar is free to download and has no in-app purchases and no subscription. There is nothing to unlock and no account to create. The app carries advertising, which is what pays for the data pipeline and hosting.",
  },
];

const faqPageLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const metadata: Metadata = {
  title: "Fed and ECB rate decision probabilities, with 60 days of history",
  description:
    "Live market-implied odds of a Fed or ECB cut, hold, or hike at every upcoming meeting, plus 60 days of history. Free iPhone app, no account needed.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "RateRadar · Fed + ECB rate-decision probabilities",
    description:
      "See what is priced in before the meeting. Fed and ECB probabilities with historical tracking.",
    type: "website",
  },
};

export const revalidate = 300; // ISR: refresh every 5 minutes

async function prefetchHistory(
  snapshots: MeetingProbabilities[],
  count: number,
): Promise<Record<string, ProbabilitySeries[]>> {
  const out: Record<string, ProbabilitySeries[]> = {};
  for (const s of snapshots.slice(0, count)) {
    out[s.meeting.id] = await getMeetingHistory(s.meeting.id, 60);
  }
  return out;
}

function soonestMeeting(
  fed: MeetingProbabilities[],
  ecb: MeetingProbabilities[],
): MeetingProbabilities | null {
  const all = [...fed, ...ecb];
  if (all.length === 0) return null;
  return all.reduce((earliest, cur) =>
    cur.meeting.meeting_date < earliest.meeting.meeting_date ? cur : earliest,
  );
}

export default async function Home() {
  const [fed, ecb] = await Promise.all([
    getFedProbabilities(),
    getEcbProbabilities(),
  ]);

  const [fedHistory, ecbHistory, fedSnapshotMeta] = await Promise.all([
    prefetchHistory(fed, 3),
    prefetchHistory(ecb, 3),
    loadJsonSnapshotAt("FED"),
  ]);

  const next = soonestMeeting(fed, ecb);
  const nextTop = next
    ? [...next.outcomes].sort((a, b) => b.probability - a.probability)[0]
    : null;

  const methodologyVersion = fedSnapshotMeta?.version ?? "1.0.0";
  const latestSnapshotAt =
    fedSnapshotMeta?.at ?? next?.snapshot_at ?? fed[0]?.snapshot_at ?? null;
  const dataSource: "supabase" | "json" | "mock" = fedSnapshotMeta
    ? "json"
    : fed.length > 0
      ? "supabase"
      : "mock";

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }}
      />
      <header className="mb-16">
        <SectionLabel>Market-implied odds, Fed and ECB</SectionLabel>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Fed and ECB rate decision probabilities
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          See whether a cut, hold, or hike is priced into the next FOMC and ECB
          meeting, and how those odds moved over the past 60 days. Free on
          iPhone, and live on this page.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="hero" priority />
          <span className="text-sm text-ink-mute">
            Free, no account, no in-app purchases. iOS 17 or later.
          </span>
        </div>
        <p
          data-geo-definition
          className="mt-7 max-w-2xl text-base leading-relaxed text-ink-soft"
        >
          {GEO_DEFINITION}
        </p>
        <div className="mt-6">
          <MethodologyBadge
            version={methodologyVersion}
            snapshotAt={latestSnapshotAt}
            source={dataSource}
          />
        </div>
      </header>

      <Rule />

      <section className="my-12" aria-labelledby="app-heading">
        <SectionLabel>The app</SectionLabel>
        <h2
          id="app-heading"
          className="mt-2 font-serif text-3xl font-medium leading-tight tracking-tight text-ink"
        >
          What the iPhone app shows you
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
          The same probabilities you see below, on your home screen, with the
          history chart and alerts that this page cannot give you.
        </p>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {SHOTS.map((s, i) => (
            <li key={s.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.alt}
                width={221}
                height={480}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full rounded-lg border border-ink/10"
              />
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="screenshots" />
          <p className="max-w-md text-sm leading-relaxed text-ink-mute">
            More on the app:{" "}
            <Link
              href="/fed-rate-tracker-app"
              className="text-cut underline-offset-4 hover:text-ink hover:underline"
            >
              what it does
            </Link>
            ,{" "}
            <Link
              href="/rate-cut-alerts"
              className="text-cut underline-offset-4 hover:text-ink hover:underline"
            >
              how the alerts work
            </Link>
            , and{" "}
            <Link
              href="/cme-fedwatch-alternative"
              className="text-cut underline-offset-4 hover:text-ink hover:underline"
            >
              how it compares to CME FedWatch
            </Link>
            .
          </p>
        </div>
      </section>

      <Rule />

      {next && nextTop && (
        <section className="my-12">
          <SectionLabel>Next decision</SectionLabel>
          <div className="mt-4 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="text-sm uppercase tracking-wider text-cut">
                {next.meeting.bank_code === "FED" ? "Federal Reserve" : "European Central Bank"}{" "}
                ·{" "}
                {new Date(next.meeting.meeting_date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { dateStyle: "long" },
                )}
              </div>
              <h2 className="mt-2 font-serif text-3xl font-medium leading-tight">
                {nextTop.label === "Hold" ? "Hold rates" : `Move ${nextTop.label}`}
              </h2>
              <p className="mt-2 text-ink-soft">
                Current policy rate{" "}
                <span className="font-mono tabular-nums">
                  {CURRENT_POLICY_RATES[next.meeting.bank_code]}%
                </span>
                . Market puts{" "}
                <span className="font-mono tabular-nums font-semibold text-ink">
                  {(nextTop.probability * 100).toFixed(0)}%
                </span>{" "}
                on this outcome.
              </p>
            </div>
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        </section>
      )}

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Most likely path · cumulative</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {fed.length > 0 && <MostLikelyPath snapshots={fed} label="Fed path" />}
          {ecb.length > 0 && <MostLikelyPath snapshots={ecb} label="ECB path" />}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-10" aria-label="Sponsored">
        <AdSlot slot="4397253039" format="auto" />
      </section>

      <section className="my-12">
        <SectionLabel>Implied rate curves</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {fed.length > 0 && (
            <ImpliedRateCurve
              snapshots={fed}
              startingRate={CURRENT_POLICY_RATES.FED}
              bankLabel="Federal Reserve"
            />
          )}
          {ecb.length > 0 && (
            <ImpliedRateCurve
              snapshots={ecb}
              startingRate={CURRENT_POLICY_RATES.ECB}
              bankLabel="European Central Bank"
            />
          )}
        </div>
      </section>

      {fed.length > 0 && (
        <>
          <Rule tone="soft" />
          <section className="my-12">
            <SectionLabel>Per-meeting probabilities · Fed</SectionLabel>
            <div className="mt-6 space-y-12">
              {fed.slice(0, 3).map((s) => (
                <ProbabilityTable
                  key={s.meeting.id}
                  data={s}
                  history={fedHistory[s.meeting.id]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {ecb.length > 0 && (
        <>
          <Rule tone="soft" />
          <section className="my-12">
            <SectionLabel>Per-meeting probabilities · ECB</SectionLabel>
            <div className="mt-6 space-y-12">
              {ecb.slice(0, 3).map((s) => (
                <ProbabilityTable
                  key={s.meeting.id}
                  data={s}
                  history={ecbHistory[s.meeting.id]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {fed.length === 0 && ecb.length === 0 && (
        <p className="my-12 text-ink-mute">
          No upcoming meetings found. Check back soon.
        </p>
      )}

      <Rule tone="soft" />

      <section className="my-12" aria-labelledby="faq-heading">
        <SectionLabel>FAQ</SectionLabel>
        <h2
          id="faq-heading"
          className="mt-4 font-serif text-3xl font-medium leading-tight tracking-tight text-ink"
        >
          Frequently asked questions
        </h2>
        <dl className="mt-8 space-y-8">
          {FAQ_ITEMS.map((f) => (
            <div key={f.q}>
              <dt className="font-serif text-xl font-medium text-ink">{f.q}</dt>
              <dd className="mt-2 max-w-2xl leading-relaxed text-ink-soft">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="faq" />
          <span className="text-sm text-ink-mute">
            Get the odds and the alerts on your phone.
          </span>
        </div>
      </section>

      <Rule />

      <footer className="mt-12 pt-8 text-sm text-ink-mute">
        <p>
          Data computed in-house from Fed Funds Futures (Yahoo Finance) and €STR OIS
          quotes using the public CME methodology. Not financial advice.
        </p>
        <p className="mt-3 text-xs">
          Built by{" "}
          <a
            href="https://github.com/lawoflarge"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            lawoflarge
          </a>
        </p>
      </footer>
    </main>
  );
}
