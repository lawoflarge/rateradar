import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · RateRadar",
  description:
    "RateRadar's privacy policy. What we collect, what we don't, and how Google AdSense advertising works on this site.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · RateRadar",
    description:
      "What RateRadar collects, what we don't, and how Google AdSense advertising works on this site.",
    type: "website",
  },
};

const LAST_UPDATED = "2026-05-20";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-ink">
          Privacy Policy
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          We keep data collection minimal and we don&apos;t sell your data.
          RateRadar is funded by Google AdSense advertising, which means
          ad-related cookies and identifiers are used on this site. This page
          tells you exactly what happens.
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
          2. What we collect directly
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          There are no accounts, no sign-ups, no email forms, and no
          first-party analytics SDKs. What we collect ourselves:
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
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          3. Advertising (Google AdSense)
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar shows ads via{" "}
          <strong className="text-ink">Google AdSense</strong>. Ads pay for the
          data pipeline, the hosting, and the time spent building features. We
          do not sell user data; the relationship is between you and Google as
          a third-party ad provider.
        </p>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Cookies and identifiers.</strong>{" "}
            Google may set cookies and read device identifiers when it serves
            ads on this site, for the purposes of ad delivery, frequency
            capping, attribution, and ad personalization.
          </li>
          <li>
            <strong className="text-ink">EU/EEA/UK consent.</strong> If you
            visit from the EU, EEA, or UK, a consent banner powered by Google
            Funding Choices appears on your first visit. The banner uses the
            IAB Transparency &amp; Consent Framework (TCF v2.2). You can
            consent to personalized ads, reject them (you&apos;ll still see
            non-personalized ads), or manage individual vendor purposes.
          </li>
          <li>
            <strong className="text-ink">Other regions.</strong> Outside the
            EU/EEA/UK, ads are served with personalization unless you opt out
            via Google&apos;s controls (see §6 below). Where U.S. state
            privacy laws apply (for example, California&apos;s CCPA/CPRA),
            our use of AdSense may be classified as &quot;sharing&quot;
            personal information for cross-context behavioral advertising.
          </li>
          <li>
            <strong className="text-ink">iOS app.</strong> The RateRadar iOS
            app shows ads via Google AdMob (a native ad SDK). On first use,
            iOS asks for App Tracking Transparency permission; only if you
            allow tracking may Google access the iOS Advertising Identifier
            (IDFA) to personalize ads and detect ad fraud. If you decline,
            ads are still shown without IDFA-based tracking. In the
            EU/EEA/UK, a Google consent form lets you choose between
            personalized and non-personalized ads.
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          4. What we don&apos;t do
        </h2>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>We do not sell your personal data.</li>
          <li>We do not share data with data brokers.</li>
          <li>
            We do not combine RateRadar data with data from third-party apps,
            websites, or services for our own tracking purposes.
          </li>
          <li>
            We do not access the iOS Advertising Identifier (IDFA) without
            your explicit App Tracking Transparency consent.
          </li>
          <li>
            We do not run our own analytics SDKs, fingerprinting, location
            tracking, microphone, camera, contacts, or health-data access.
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          5. Service providers
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          We use a small set of infrastructure and advertising providers to
          operate the service. Each only sees the minimum data needed to do
          their job.
        </p>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Vercel</strong> hosts the website
            and serverless functions. Sees standard HTTP request metadata.
          </li>
          <li>
            <strong className="text-ink">Supabase</strong> stores
            probability snapshots and meeting metadata (public market data;
            no user information).
          </li>
          <li>
            <strong className="text-ink">Apple Push Notification Service</strong>{" "}
            (APNs) delivers iOS push notifications. Sees the device token
            and message payload (no personal information).
          </li>
          <li>
            <strong className="text-ink">Google LLC</strong> — provides
            advertising via Google AdSense (web) and Google AdMob (iOS app),
            and consent management via Google Funding Choices. Google&apos;s use of data is governed by its{" "}
            <a
              className="text-ink underline decoration-amber underline-offset-4"
              href="https://policies.google.com/technologies/ads"
              rel="noopener noreferrer"
              target="_blank"
            >
              Advertising Privacy &amp; Terms
            </a>{" "}
            and its{" "}
            <a
              className="text-ink underline decoration-amber underline-offset-4"
              href="https://policies.google.com/privacy"
              rel="noopener noreferrer"
              target="_blank"
            >
              Privacy Policy
            </a>
            .
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          6. Your rights and controls
        </h2>
        <ul className="my-4 list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">EU/EEA/UK consent.</strong> You can
            change or withdraw your ad consent at any time. To re-open the
            consent banner, clear cookies for this site or use your
            browser&apos;s privacy controls; the banner will appear again on
            your next visit.
          </li>
          <li>
            <strong className="text-ink">Google personalization
            controls.</strong> You can opt out of ad personalization across
            Google services at{" "}
            <a
              className="text-ink underline decoration-amber underline-offset-4"
              href="https://adssettings.google.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              adssettings.google.com
            </a>
            .
          </li>
          <li>
            <strong className="text-ink">Push notifications.</strong> You can
            disable push notifications in iOS Settings at any time. To remove
            your APNs token from our server entirely, simply uninstall the
            app, and iOS will notify our server so the token will be deleted.
          </li>
          <li>
            <strong className="text-ink">Other requests.</strong> For data
            access, deletion, or any other privacy request, email{" "}
            <a
              className="text-ink underline decoration-amber underline-offset-4"
              href="mailto:levin.schwab@gmx.de"
            >
              levin.schwab@gmx.de
            </a>{" "}
            and we will respond within 30 days.
          </li>
        </ul>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          7. Children
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          RateRadar is not directed at children under 13 and we do not
          knowingly collect data from children.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          8. Changes to this policy
        </h2>
        <p className="my-4 text-lg leading-relaxed text-ink-soft">
          If we materially change how we handle data, we will update the date
          at the top of this page and, where required by law, give notice in
          the app. The current version is always the canonical one.
        </p>

        <h2 className="mt-12 mb-4 font-serif text-2xl font-medium text-ink">
          9. Contact
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
