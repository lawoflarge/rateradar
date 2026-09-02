import type { Metadata } from "next";
import Link from "next/link";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { JsonLd } from "@/components/JsonLd";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";

const BASE_URL = "https://rateradar-web.vercel.app";

export const metadata: Metadata = {
  title: "Fed Rate Tracker App for iPhone",
  description:
    "A free iPhone app for FOMC and ECB rate decisions: the odds of a cut, hold, or hike at every meeting, 60 days of probability history, and alerts when the odds move. No account, no in-app purchases.",
  alternates: { canonical: "/fed-rate-tracker-app" },
  openGraph: {
    title: "Fed Rate Tracker App for iPhone · RateRadar",
    description:
      "FOMC and ECB decision odds, 60 days of history, and alerts when the odds move. Free on iPhone.",
    type: "website",
    images: ["/api/og/default"],
  },
};

const SCREENS = [
  {
    src: "/shots/01.webp",
    alt: "RateRadar dashboard on iPhone showing the next Federal Reserve decision and the current market-implied odds.",
    title: "The next decision, first thing",
    body: "The dashboard opens on whichever meeting comes next, Fed or ECB, with a countdown, the current policy rate, and the outcome the market is leaning toward.",
  },
  {
    src: "/shots/02.webp",
    alt: "Outcome distribution screen asking whether the Fed will cut rates on December 9, 2026, with hold at 64 percent as the most likely outcome.",
    title: "Every outcome, not just the headline",
    body: "Each meeting breaks out into its full distribution: hold, 25 bps, 50 bps, in either direction, each with its own probability and the post-meeting rate it implies.",
  },
  {
    src: "/shots/03.webp",
    alt: "Per-meeting probability table for an FOMC meeting with a 60-day probability history chart underneath.",
    title: "Sixty days of how the odds moved",
    body: "Under every meeting sits a history chart. The odds are saved each run and kept for 60 days, so you see the drift into the meeting rather than one frozen snapshot.",
  },
  {
    src: "/shots/04.webp",
    alt: "Alerts settings screen with meeting reminders and rate shift alerts, and a sharp move threshold set to 8 percentage points.",
    title: "A nudge when something changes",
    body: "Meeting reminders the evening before and the morning of each decision, plus a rate shift alert when the leading outcome flips or moves past a threshold you set.",
  },
];

const FAQ = [
  {
    q: "Is there a free app to track Fed interest rate decisions?",
    a: "Yes. RateRadar is free to download from the App Store, has no in-app purchases and no subscription, and needs no account. It is funded by advertising, which appears inside the app.",
  },
  {
    q: "What iPhone do I need?",
    a: "RateRadar requires iOS 17 or later. It is an iPhone app; there is no iPad-specific layout, no Apple Watch app, and no home screen widget at this point.",
  },
  {
    q: "How often do the numbers update?",
    a: "The pipeline runs twice per business day, after the European close and after the US close, and writes a fresh snapshot each time. Between runs the app shows the last computed snapshot with its timestamp, so you always know how old a number is.",
  },
  {
    q: "Does the app cover the ECB as well as the Fed?",
    a: "It covers both calendars. Fed probabilities are derived forward from 30-Day Fed Funds Futures. ECB coverage tracks the Governing Council calendar and the current Deposit Facility Rate, and is spot anchored, because there is no free forward rate source of the same quality for the euro area yet.",
  },
];

export default function FedRateTrackerAppPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "Fed rate tracker app",
              item: `${BASE_URL}/fed-rate-tracker-app`,
            },
          ],
        }}
      />

      <nav className="mb-8 text-sm text-ink-mute">
        <Link href="/" className="underline-offset-4 hover:text-cut hover:underline">
          Home
        </Link>{" "}
        / <span className="text-ink">Fed rate tracker app</span>
      </nav>

      <header className="mb-10">
        <SectionLabel>iPhone app</SectionLabel>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Fed rate tracker app for iPhone
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          RateRadar puts the market-implied odds of every upcoming FOMC and ECB
          decision on your phone, keeps 60 days of how those odds moved, and
          tells you when they move sharply.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="app-hero" priority />
          <span className="text-sm text-ink-mute">
            Free. No account, no in-app purchases. iOS 17 or later.
          </span>
        </div>
      </header>

      <Rule />

      <section className="my-12">
        <SectionLabel>Screen by screen</SectionLabel>
        <div className="mt-8 space-y-12">
          {SCREENS.map((s, i) => (
            <article
              key={s.src}
              className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-start"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.alt}
                width={221}
                height={480}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full max-w-[180px] rounded-lg border border-ink/10"
              />
              <div>
                <h2 className="font-serif text-2xl font-medium leading-tight text-ink">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>What it is not</SectionLabel>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">
          The honest limits
        </h2>
        <ul className="mt-6 list-disc space-y-3 pl-6 leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">It is not a forecast.</strong> A
            market-implied probability is what futures prices say traders are
            paying for an outcome. It is not a prediction of what the committee
            will decide, and it is not financial advice.
          </li>
          <li>
            <strong className="text-ink">It is not tick by tick.</strong> The
            cadence is deliberately twice per business day, after the European
            close and after the US close. If you need intraday ticks, you need a
            terminal, not this app.
          </li>
          <li>
            <strong className="text-ink">
              ECB odds are spot anchored today.
            </strong>{" "}
            The ECB side tracks the Governing Council calendar and the current
            Deposit Facility Rate. Forward-implied ECB probabilities of the same
            quality as the Fed side are not there yet.
          </li>
          <li>
            <strong className="text-ink">It carries ads.</strong> That is how a
            free app with a running data pipeline pays for itself. There is no
            paid tier that removes them.
          </li>
          <li>
            <strong className="text-ink">There is no widget.</strong> Alerts and
            the app itself are the ways in; there is no home screen widget and
            no Apple Watch app.
          </li>
        </ul>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Where the numbers come from</SectionLabel>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          Fed probabilities are computed in house from 30-Day Fed Funds Futures
          using the published step function decomposition. Euro area rates come
          from the ECB Data Portal, with a Federal Reserve Economic Data series
          as a fallback. Meeting calendars come from federalreserve.gov and
          ecb.europa.eu. Nothing is scraped from CME FedWatch or ECB Watch. The
          full derivation is on the{" "}
          <Link
            href="/methodology"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            methodology page
          </Link>
          , and the terms are defined in the{" "}
          <Link
            href="/glossary"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            glossary
          </Link>
          .
        </p>
      </section>

      <Rule tone="soft" />

      <section className="my-12" aria-labelledby="app-faq">
        <SectionLabel>FAQ</SectionLabel>
        <h2
          id="app-faq"
          className="mt-2 font-serif text-3xl font-medium leading-tight text-ink"
        >
          Questions people ask before downloading
        </h2>
        <dl className="mt-8 space-y-8">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-serif text-xl font-medium text-ink">{f.q}</dt>
              <dd className="mt-2 max-w-2xl leading-relaxed text-ink-soft">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Rule />

      <section className="my-12">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="app-footer" />
          <span className="text-sm text-ink-mute">
            Free on the App Store. iOS 17 or later.
          </span>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-mute">
          Related reading:{" "}
          <Link
            href="/rate-cut-alerts"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            how the rate cut alerts work
          </Link>
          ,{" "}
          <Link
            href="/cme-fedwatch-alternative"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            how this compares to CME FedWatch
          </Link>
          , the{" "}
          <Link
            href="/fed"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            next FOMC meeting
          </Link>
          , and the{" "}
          <Link
            href="/"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            live probability dashboard
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
