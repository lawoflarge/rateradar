import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About RateRadar",
  description:
    "RateRadar is a modern, mobile-first tracker for Fed and ECB rate decisions — with the historical probability charts every other tool is missing.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
          About RateRadar
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          See where rates are headed — before the meeting.
        </p>
      </header>

      <article>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          Retail traders and macro-curious investors rely on two disconnected
          tools to read central-bank rate expectations:{" "}
          <strong className="text-ink">CME FedWatch</strong> for the Fed and{" "}
          <strong className="text-ink">ECB Watch</strong> for the ECB. Both have
          the same four gaps:
        </p>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">No historical probability tracking.</strong>{" "}
            You see today&apos;s odds but can&apos;t see how they moved last week.
          </li>
          <li>
            <strong className="text-ink">Fragmented.</strong> No single product
            covers Fed and ECB.
          </li>
          <li>
            <strong className="text-ink">Dated UX.</strong> Dense tables, poor
            mobile, no sharing.
          </li>
          <li>
            <strong className="text-ink">No engagement loop.</strong> No alerts,
            no widgets, no iOS app.
          </li>
        </ul>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar fixes all four. We combine Fed + ECB in a modern interface,
          expose 60 days of historical probability charts, and make every
          meeting snapshot shareable. Coming soon: a native iOS app with
          home-screen widgets and meeting-day push notifications.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          How we stay honest
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          Every number you see is computed in-house from licensed-free futures
          and OIS prices, using the{" "}
          <Link
            href="/methodology"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            public CME methodology
          </Link>
          . We don&apos;t scrape CME or ECB Watch. Every snapshot is validated
          against live data; divergences are logged and fixed.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          How we stay free
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          Ads (Google AdSense / AdMob on iOS) and transparent broker affiliate
          partnerships (see{" "}
          <Link
            href="/brokers"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            /brokers
          </Link>
          ) cover the infrastructure costs. A Pro tier with custom alerts,
          CSV/API export, and advanced conditional scenarios is planned for
          later.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          Source code
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar is developed openly at{" "}
          <a
            href="https://github.com/lawoflarge/rateradar"
            className="text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            github.com/lawoflarge/rateradar
          </a>
          . Feedback and bug reports welcome via GitHub issues.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          Not financial advice
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar shows what the market is pricing. It doesn&apos;t predict
          what central banks will actually decide. Nothing here is a
          recommendation to trade, invest, or change your financial plans.
        </p>
      </article>
    </main>
  );
}
