import type { Metadata } from "next";
import Link from "next/link";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { JsonLd } from "@/components/JsonLd";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";

const BASE_URL = "https://rateradar-web.vercel.app";

export const metadata: Metadata = {
  title: "CME FedWatch Alternative for iPhone",
  description:
    "An honest comparison of RateRadar and the CME FedWatch Tool: what each one is for, where FedWatch is the better source, and where an iPhone app with saved probability history helps more.",
  alternates: { canonical: "/cme-fedwatch-alternative" },
  openGraph: {
    title: "CME FedWatch alternative for iPhone · RateRadar",
    description:
      "Where FedWatch is the better source, and where a phone app with 60 days of saved odds helps more.",
    type: "website",
    images: ["/api/og/default"],
  },
};

interface Row {
  aspect: string;
  fedwatch: string;
  rateradar: string;
  /** Who genuinely wins this row. Drives the marker, so the table cannot lie. */
  edge: "fedwatch" | "rateradar" | "even";
}

const ROWS: Row[] = [
  {
    aspect: "Who publishes it",
    fedwatch:
      "CME Group, the exchange where the contracts actually trade. It is the number the market quotes.",
    rateradar:
      "An independent app that recomputes the odds from the same public futures prices.",
    edge: "fedwatch",
  },
  {
    aspect: "Authority",
    fedwatch:
      "The reference. When a news story cites odds of a cut, this is usually the source.",
    rateradar:
      "Derived independently, so small differences from the exchange tool are possible.",
    edge: "fedwatch",
  },
  {
    aspect: "Contract depth",
    fedwatch:
      "Full contract-level detail, a long archive, and tools built around the futures curve.",
    rateradar:
      "One contract per meeting. Simpler, and noisier when a meeting falls near a month end.",
    edge: "fedwatch",
  },
  {
    aspect: "Cost",
    fedwatch: "Free on the web.",
    rateradar: "Free on the App Store, no in-app purchases. Carries ads.",
    edge: "even",
  },
  {
    aspect: "On a phone",
    fedwatch: "A web page. Usable on mobile, but not built as an app.",
    rateradar: "A native iPhone app, built mobile first.",
    edge: "rateradar",
  },
  {
    aspect: "History of the odds",
    fedwatch:
      "Shows what is priced now. Reading how the odds drifted over recent weeks is not the main view.",
    rateradar:
      "Saves the probability of every outcome each run and keeps 60 days, charted under each meeting.",
    edge: "rateradar",
  },
  {
    aspect: "ECB alongside the Fed",
    fedwatch: "Fed focused. The ECB equivalent is a separate tool.",
    rateradar:
      "Both calendars in one app, though ECB coverage is spot anchored rather than forward implied.",
    edge: "rateradar",
  },
  {
    aspect: "Alerts",
    fedwatch: "No push alerts when the odds move.",
    rateradar:
      "Meeting reminders and an alert when the leading outcome flips or moves past your threshold.",
    edge: "rateradar",
  },
  {
    aspect: "Update speed",
    fedwatch: "Tracks the live session.",
    rateradar: "Twice per business day, after the European close and the US close.",
    edge: "fedwatch",
  },
];

const EDGE_LABEL: Record<Row["edge"], string> = {
  fedwatch: "FedWatch",
  rateradar: "RateRadar",
  even: "Even",
};

export default function FedWatchAlternativePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "CME FedWatch alternative",
              item: `${BASE_URL}/cme-fedwatch-alternative`,
            },
          ],
        }}
      />

      <nav className="mb-8 text-sm text-ink-mute">
        <Link href="/" className="underline-offset-4 hover:text-cut hover:underline">
          Home
        </Link>{" "}
        / <span className="text-ink">CME FedWatch alternative</span>
      </nav>

      <header className="mb-10">
        <SectionLabel>Comparison</SectionLabel>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          CME FedWatch alternative for iPhone
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          The CME FedWatch Tool is the reference for what the market prices into
          an FOMC decision, and it is free. This page explains where it stays
          the better source, and the two or three things a phone app can do that
          a web tool does not.
        </p>
        <div className="mt-7">
          <AppStoreBadge slug="alt-fedwatch-hero" priority />
        </div>
      </header>

      <Rule />

      <section className="my-12">
        <SectionLabel>Where FedWatch wins</SectionLabel>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">
          Start there, not here
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          FedWatch is published by CME Group, the exchange where 30-Day Fed Funds
          Futures actually trade. That makes it the primary source rather than a
          derived one. It has the full contract-level detail, a far longer
          archive, and it moves with the live session instead of settling twice a
          day. If you want one authoritative read on what is priced in right
          now, that is the one to open, and RateRadar does not try to replace it.
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          RateRadar recomputes its odds independently from the same public
          futures prices, using the published step function method. It never
          scrapes FedWatch. Independent computation means the two can differ
          slightly, and when they do, the exchange is the one to trust.
        </p>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Where a phone app helps</SectionLabel>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">
          The gap it fills
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          The question that is hard to answer from any live tool is not what the
          odds are, it is what they were. A hold at 64 percent means something
          different when it was 30 percent a fortnight ago than when it has sat
          there all month. RateRadar saves the probability of every outcome on
          each run and keeps 60 days of it, charted underneath the meeting, and
          it will tell you when the leading outcome flips or moves past a
          threshold you choose. It also carries the ECB calendar next to the Fed
          one.
        </p>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Side by side</SectionLabel>
        <h2 className="mt-2 mb-6 font-serif text-3xl font-medium leading-tight text-ink">
          Nine differences that actually matter
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Comparison of the CME FedWatch Tool and the RateRadar iPhone app.
            </caption>
            <thead>
              <tr className="border-b border-ink/25">
                <th scope="col" className="py-3 pr-4 font-mono text-xs uppercase tracking-wider text-ink-mute">
                  Aspect
                </th>
                <th scope="col" className="py-3 pr-4 font-mono text-xs uppercase tracking-wider text-ink-mute">
                  CME FedWatch
                </th>
                <th scope="col" className="py-3 pr-4 font-mono text-xs uppercase tracking-wider text-ink-mute">
                  RateRadar
                </th>
                <th scope="col" className="py-3 font-mono text-xs uppercase tracking-wider text-ink-mute">
                  Edge
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.aspect} className="border-b border-ink/10 align-top">
                  <th scope="row" className="py-4 pr-4 font-medium text-ink">
                    {r.aspect}
                  </th>
                  <td className="py-4 pr-4 leading-relaxed text-ink-soft">
                    {r.fedwatch}
                  </td>
                  <td className="py-4 pr-4 leading-relaxed text-ink-soft">
                    {r.rateradar}
                  </td>
                  <td className="py-4 font-mono text-xs uppercase tracking-wider text-ink-mute">
                    {EDGE_LABEL[r.edge]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-ink-mute">
          Four of the nine rows go to FedWatch. The comparison is only useful if
          it is allowed to lose.
        </p>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Which to use</SectionLabel>
        <h2 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">
          Honestly, both
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          Use FedWatch when you want the exchange&apos;s own live read on a
          single meeting, or when you need contract-level depth. Use RateRadar
          when you want the same question answered on your phone, want to see
          how the answer changed over the past 60 days, want the ECB calendar
          beside the Fed one, or want to be told when something moves rather
          than checking.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreBadge slug="alt-fedwatch-footer" />
          <span className="text-sm text-ink-mute">
            Free. No account, no in-app purchases.
          </span>
        </div>
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm leading-relaxed text-ink-mute">
        <p>
          Read on: the{" "}
          <Link
            href="/fed-rate-tracker-app"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            app in detail
          </Link>
          ,{" "}
          <Link
            href="/rate-cut-alerts"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            how the alerts work
          </Link>
          , the{" "}
          <Link
            href="/methodology"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            calculation itself
          </Link>
          , or the{" "}
          <Link
            href="/"
            className="text-cut underline-offset-4 hover:text-ink hover:underline"
          >
            live dashboard
          </Link>
          .
        </p>
        <p className="mt-4">
          CME Group and FedWatch are trademarks of their respective owner.
          RateRadar is not affiliated with, endorsed by, or connected to CME
          Group. Nothing here is financial advice.
        </p>
      </footer>
    </main>
  );
}
