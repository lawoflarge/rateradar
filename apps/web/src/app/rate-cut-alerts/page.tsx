import type { Metadata } from "next";
import Link from "next/link";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { JsonLd } from "@/components/JsonLd";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";

const BASE_URL = "https://rateradar-web.vercel.app";

export const metadata: Metadata = {
  title: "Fed Rate Cut Alerts on iPhone",
  description:
    "Get a notification before every FOMC and ECB decision, and when the odds of a cut move sharply. Two alert types, one threshold you set yourself, from 5 to 25 percentage points.",
  alternates: { canonical: "/rate-cut-alerts" },
  openGraph: {
    title: "Fed rate cut alerts on iPhone · RateRadar",
    description:
      "A reminder before each decision, and a nudge when the odds of a cut move past your threshold.",
    type: "website",
    images: ["/api/og/default"],
  },
};

const FAQ = [
  {
    q: "How do I get an alert when the Fed cuts rates?",
    a: "Install RateRadar on iPhone and allow notifications. Meeting reminders and rate shift alerts are both on by default, so you get a heads-up the evening before and the morning of every Fed and ECB decision, and a separate alert whenever the odds move sharply between refreshes.",
  },
  {
    q: "What counts as a sharp move?",
    a: "Two things trigger a rate shift alert: the most likely outcome for a meeting changes, or the probability of the leading outcome moves by at least your threshold since the last snapshot the app saw. The threshold defaults to 8 percentage points and you can set it anywhere from 5 to 25.",
  },
  {
    q: "Will it wake me up for every small wiggle?",
    a: "No. The probabilities are recomputed twice per business day, not tick by tick, and a move only counts if it clears your threshold. On a quiet week you may hear nothing between the two meeting reminders.",
  },
  {
    q: "Do I need an account for alerts?",
    a: "No. There are no accounts in RateRadar. The alert preferences live on your device and the reminders are scheduled locally, so nothing about your settings leaves the phone.",
  },
  {
    q: "Can I turn one kind off and keep the other?",
    a: "Yes. Meeting reminders and rate shift alerts are separate toggles on the Alerts screen. Turning off notification permission in iOS Settings stops both.",
  },
];

const KINDS = [
  {
    label: "Meeting reminders",
    headline: "The evening before, and the morning of",
    body: "Every scheduled Fed and ECB decision gets two reminders, and each one carries the current odds rather than just the date. You walk into the announcement knowing what was priced in going in.",
  },
  {
    label: "Rate shift alerts",
    headline: "When the odds move past your line",
    body: "Between refreshes the app compares the new leading outcome against the last one it saw. If the leader flips, or its probability moves by at least your threshold, you get one alert naming the meeting and the move.",
  },
];

export default function RateCutAlertsPage() {
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
              name: "Rate cut alerts",
              item: `${BASE_URL}/rate-cut-alerts`,
            },
          ],
        }}
      />

      <nav className="mb-8 text-sm text-ink-mute">
        <Link href="/" className="underline-offset-4 hover:text-cut hover:underline">
          Home
        </Link>{" "}
        / <span className="text-ink">Rate cut alerts</span>
      </nav>

      <header className="mb-10">
        <SectionLabel>Notifications</SectionLabel>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Fed rate cut alerts on iPhone
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Checking the odds every morning is a chore. RateRadar reverses it: a
          reminder before each Fed and ECB decision, and a nudge when the odds of
          a cut move past a threshold you set.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="alerts-hero" priority />
          <span className="text-sm text-ink-mute">
            Free. Both alert types on by default.
          </span>
        </div>
      </header>

      <Rule />

      <section className="my-12 grid gap-10 sm:grid-cols-[200px_1fr] sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shots/04.webp"
          alt="Alerts settings screen with meeting reminders and rate shift alerts, and a sharp move threshold set to 8 percentage points."
          width={221}
          height={480}
          loading="eager"
          decoding="async"
          className="h-auto w-full max-w-[200px] rounded-lg border border-ink/10"
        />
        <div>
          <SectionLabel>Two kinds</SectionLabel>
          <div className="mt-4 space-y-8">
            {KINDS.map((k) => (
              <article key={k.label}>
                <div className="font-mono text-xs uppercase tracking-wider text-cut">
                  {k.label}
                </div>
                <h2 className="mt-2 font-serif text-2xl font-medium leading-tight text-ink">
                  {k.headline}
                </h2>
                <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
                  {k.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>The threshold</SectionLabel>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">
          You decide what counts as news
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          The sharp move threshold is a number of percentage points, adjustable
          between 5 and 25, and it starts at 8. Set it low and you hear about
          most of the drift into a meeting. Set it high and you only hear when
          something has genuinely repriced. Either way, the alert fires at most
          once per meeting per refresh, and the app compares against the last
          snapshot it actually saw, so nothing is double counted.
        </p>
        <dl className="mt-8 grid gap-8 border-y border-ink/15 py-8 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-ink-mute">
              Range
            </dt>
            <dd className="mt-2 font-serif text-2xl font-medium text-ink">
              <span className="font-mono tabular-nums">5</span> to{" "}
              <span className="font-mono tabular-nums">25</span> pts
            </dd>
          </div>
          <div className="sm:border-l sm:border-ink/15 sm:pl-8">
            <dt className="font-mono text-xs uppercase tracking-wider text-ink-mute">
              Default
            </dt>
            <dd className="mt-2 font-serif text-2xl font-medium text-ink">
              <span className="font-mono tabular-nums">8</span> pts
            </dd>
          </div>
          <div className="sm:border-l sm:border-ink/15 sm:pl-8">
            <dt className="font-mono text-xs uppercase tracking-wider text-ink-mute">
              Refresh cadence
            </dt>
            <dd className="mt-2 font-serif text-2xl font-medium text-ink">
              <span className="font-mono tabular-nums">2</span> per business day
            </dd>
          </div>
        </dl>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Setting them up</SectionLabel>
        <ol className="mt-4 max-w-2xl list-decimal space-y-3 pl-6 leading-relaxed text-ink-soft">
          <li>Install RateRadar and allow notifications when iOS asks.</li>
          <li>
            Open the Alerts screen. Meeting reminders and rate shift alerts are
            both already on.
          </li>
          <li>
            Move the sharp move threshold if 8 percentage points is too chatty or
            too quiet for you.
          </li>
          <li>
            Change your mind later in the app, or switch everything off in iOS
            Settings under Notifications.
          </li>
        </ol>
      </section>

      <Rule tone="soft" />

      <section className="my-12" aria-labelledby="alerts-faq">
        <SectionLabel>FAQ</SectionLabel>
        <h2
          id="alerts-faq"
          className="mt-2 font-serif text-3xl font-medium leading-tight text-ink"
        >
          Alert questions
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
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="alerts-footer" />
          <span className="text-sm text-ink-mute">
            Free on the App Store. iOS 17 or later.
          </span>
        </div>
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm leading-relaxed text-ink-mute">
        <p>
          Related:{" "}
          <Link
            href="/fed-rate-tracker-app"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            the app in detail
          </Link>
          ,{" "}
          <Link
            href="/cme-fedwatch-alternative"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            compared with CME FedWatch
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
            href="/ecb"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            next ECB meeting
          </Link>
          .
        </p>
        <p className="mt-4">
          Alerts describe what the market is pricing. They are not a prediction
          of what a central bank will decide, and they are not financial advice.
        </p>
      </footer>
    </main>
  );
}
