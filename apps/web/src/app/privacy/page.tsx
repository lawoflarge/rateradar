import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · RateRadar",
  description:
    "RateRadar's privacy policy. We collect almost nothing, we don't sell data, and we don't run third-party trackers.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "2026-05-12";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
          Privacy Policy
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          We collect almost nothing. We don&apos;t sell data. We don&apos;t run
          third-party advertising trackers. This page tells you exactly what
          happens to any information that touches RateRadar.
        </p>
        <p className="mt-3 text-sm text-ink-mute">Last updated: {LAST_UPDATED}</p>
      </header>

      <article>
        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          1. Who runs RateRadar
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar is operated by Levin Schwab, a sole proprietor based in
          Germany. You can reach the operator at{" "}
          <a
            className="text-ink underline decoration-amber underline-offset-4"
            href="mailto:levin.schwab@gmx.de"
          >
            levin.schwab@gmx.de
          </a>
          .
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          2. What we collect
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          We deliberately keep data collection minimal. There are no accounts,
          no sign-ups, no email forms, and no third-party analytics SDKs.
        </p>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Push notification tokens</strong> (iOS
            app only). If you opt in to rate-shift alerts in the RateRadar iOS
            app, your device registers an Apple Push Notification token (APNs
            device token) with our server so we can deliver alerts. The token
            identifies your device, not you. We never link it to your name,
            email, or any other identifier. RateRadar has no user accounts.
            Tokens are stored only for delivery and are rotated/revoked by iOS
            when you uninstall the app or disable notifications.
          </li>
          <li>
            <strong className="text-ink">Standard request logs</strong>{" "}
            (rateradar-web.vercel.app). Our hosting provider, Vercel, records
            standard HTTP request metadata (IP address, user agent, path,
            timestamp) for operational purposes such as abuse prevention and
            performance monitoring. These logs are not linked to any user
            identifier, are kept for short retention windows, and are not sold
            or shared.
          </li>
          <li>
            <strong className="text-ink">Nothing else.</strong> No cookies for
            advertising. No fingerprinting. No location data. No microphone,
            camera, contacts, or health data. No Sign in with Apple, Google, or
            any other identity provider. No analytics SDKs.
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          3. What we don&apos;t do
        </h2>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>We do not sell any data, ever.</li>
          <li>We do not share data with data brokers.</li>
          <li>We do not use any data for advertising or ad measurement.</li>
          <li>
            We do not combine RateRadar data with data from third-party apps,
            websites, or services for tracking purposes.
          </li>
          <li>
            We do not request the iOS Advertising Identifier (IDFA). We do not
            show our own advertising in the iOS app for the initial release.
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          4. Service providers
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          We use a small set of infrastructure providers to operate the
          service. Each only sees the minimum data needed to do their job.
        </p>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Vercel</strong> hosts the website
            and serverless functions. Sees standard HTTP request metadata.
          </li>
          <li>
            <strong className="text-ink">Supabase</strong> stores
            probability snapshots and meeting metadata (public market data; no
            user information).
          </li>
          <li>
            <strong className="text-ink">Apple Push Notification Service</strong>{" "}
            (APNs) delivers iOS push notifications. Sees the device token
            and message payload (no personal information).
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          5. Children
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar is not directed at children under 13 and we do not
          knowingly collect data from children.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          6. Your rights
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          You can disable push notifications in iOS Settings at any time. To
          remove your APNs token from our server entirely, simply uninstall
          the app, and iOS will notify our server so the token will be deleted.
          For any other request relating to your data (access, deletion, etc.),
          email{" "}
          <a
            className="text-ink underline decoration-amber underline-offset-4"
            href="mailto:levin.schwab@gmx.de"
          >
            levin.schwab@gmx.de
          </a>{" "}
          and we will respond within 30 days.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          7. Changes to this policy
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          If we materially change how we handle data, we will update the date
          at the top of this page and, where required by law, give notice in
          the app. The current version is always the canonical one.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          8. Contact
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          Email{" "}
          <a
            className="text-ink underline decoration-amber underline-offset-4"
            href="mailto:levin.schwab@gmx.de"
          >
            levin.schwab@gmx.de
          </a>{" "}
          for any privacy question.
        </p>
      </article>
    </main>
  );
}
