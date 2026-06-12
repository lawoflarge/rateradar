import SwiftUI

/// Full text port of apps/web/src/app/privacy/page.tsx (mobile rendering).
/// Static editorial page: serif H1/H2s, lg body copy, ink links underlined
/// in amber on the web (mailto / external policy links).
struct PrivacyView: View {
    private static let lastUpdated = "2026-05-20"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                article
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header (mb-10; h1 text-5xl serif medium tracking-tight,
    // p mt-6 lg ink-soft, p mt-3 sm ink-mute)

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Privacy Policy")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
            Text("We keep data collection minimal and we don't sell your data. RateRadar is funded by Google AdSense advertising, which means ad-related cookies and identifiers are used on this site. This page tells you exactly what happens.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)
            Text("Last updated: \(Self.lastUpdated)")
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)
                .padding(.top, 12)
        }
    }

    private var article: some View {
        VStack(alignment: .leading, spacing: 0) {
            section1
            section2
            section3
            section4
            section5
            section6
            section7
            section8
            section9
        }
    }

    // MARK: - Sections

    private var section1: some View {
        Group {
            h2("1. Who runs RateRadar")
            paragraph(plain("RateRadar is operated by Levin Schwab, a sole proprietor based in Germany. You can reach the operator at ") + inkLink("levin.schwab@gmx.de", "mailto:levin.schwab@gmx.de") + plain("."))
        }
    }

    private var section2: some View {
        Group {
            h2("2. What we collect directly")
            paragraph(plain("There are no accounts, no sign-ups, no email forms, and no first-party analytics SDKs. What we collect ourselves:"))
            bulletList([
                strong("Push notification tokens") + plain(" (iOS app only). If you opt in to rate-shift alerts in the RateRadar iOS app, your device registers an Apple Push Notification token (APNs device token) with our server so we can deliver alerts. The token identifies your device, not you. We never link it to your name, email, or any other identifier. RateRadar has no user accounts. Tokens are stored only for delivery and are rotated/revoked by iOS when you uninstall the app or disable notifications."),
                strong("Standard request logs") + plain(" (rateradar-web.vercel.app). Our hosting provider, Vercel, records standard HTTP request metadata (IP address, user agent, path, timestamp) for operational purposes such as abuse prevention and performance monitoring. These logs are not linked to any user identifier, are kept for short retention windows, and are not sold or shared."),
            ])
        }
    }

    private var section3: some View {
        Group {
            h2("3. Advertising (Google AdSense)")
            paragraph(plain("RateRadar shows ads via ") + strong("Google AdSense") + plain(". Ads pay for the data pipeline, the hosting, and the time spent building features. We do not sell user data; the relationship is between you and Google as a third-party ad provider."))
            bulletList([
                strong("Cookies and identifiers.") + plain(" Google may set cookies and read device identifiers when it serves ads on this site, for the purposes of ad delivery, frequency capping, attribution, and ad personalization."),
                strong("EU/EEA/UK consent.") + plain(" If you visit from the EU, EEA, or UK, a consent banner powered by Google Funding Choices appears on your first visit. The banner uses the IAB Transparency & Consent Framework (TCF v2.2). You can consent to personalized ads, reject them (you'll still see non-personalized ads), or manage individual vendor purposes."),
                strong("Other regions.") + plain(" Outside the EU/EEA/UK, ads are served with personalization unless you opt out via Google's controls (see §6 below). Where U.S. state privacy laws apply (for example, California's CCPA/CPRA), our use of AdSense may be classified as \"sharing\" personal information for cross-context behavioral advertising."),
                strong("iOS app.") + plain(" The RateRadar iOS app shows ads via Google AdMob (a native ad SDK). On first use, iOS asks for App Tracking Transparency permission; only if you allow tracking may Google access the iOS Advertising Identifier (IDFA) to personalize ads and detect ad fraud. If you decline, ads are still shown without IDFA-based tracking. In the EU/EEA/UK, a Google consent form lets you choose between personalized and non-personalized ads."),
            ])
        }
    }

    private var section4: some View {
        Group {
            h2("4. What we don't do")
            bulletList([
                plain("We do not sell your personal data."),
                plain("We do not share data with data brokers."),
                plain("We do not combine RateRadar data with data from third-party apps, websites, or services for our own tracking purposes."),
                plain("We do not access the iOS Advertising Identifier (IDFA) without your explicit App Tracking Transparency consent."),
                plain("We do not run our own analytics SDKs, fingerprinting, location tracking, microphone, camera, contacts, or health-data access."),
            ])
        }
    }

    private var section5: some View {
        Group {
            h2("5. Service providers")
            paragraph(plain("We use a small set of infrastructure and advertising providers to operate the service. Each only sees the minimum data needed to do their job."))
            bulletList([
                strong("Vercel") + plain(" hosts the website and serverless functions. Sees standard HTTP request metadata."),
                strong("Supabase") + plain(" stores probability snapshots and meeting metadata (public market data; no user information)."),
                strong("Apple Push Notification Service") + plain(" (APNs) delivers iOS push notifications. Sees the device token and message payload (no personal information)."),
                strong("Google LLC") + plain(" — provides advertising via Google AdSense (web) and Google AdMob (iOS app), and consent management via Google Funding Choices. Google's use of data is governed by its ") + inkLink("Advertising Privacy & Terms", "https://policies.google.com/technologies/ads") + plain(" and its ") + inkLink("Privacy Policy", "https://policies.google.com/privacy") + plain("."),
            ])
        }
    }

    private var section6: some View {
        Group {
            h2("6. Your rights and controls")
            bulletList([
                strong("EU/EEA/UK consent.") + plain(" You can change or withdraw your ad consent at any time. To re-open the consent banner, clear cookies for this site or use your browser's privacy controls; the banner will appear again on your next visit."),
                strong("Google personalization controls.") + plain(" You can opt out of ad personalization across Google services at ") + inkLink("adssettings.google.com", "https://adssettings.google.com") + plain("."),
                strong("Push notifications.") + plain(" You can disable push notifications in iOS Settings at any time. To remove your APNs token from our server entirely, simply uninstall the app, and iOS will notify our server so the token will be deleted."),
                strong("Other requests.") + plain(" For data access, deletion, or any other privacy request, email ") + inkLink("levin.schwab@gmx.de", "mailto:levin.schwab@gmx.de") + plain(" and we will respond within 30 days."),
            ])
        }
    }

    private var section7: some View {
        Group {
            h2("7. Children")
            paragraph(plain("RateRadar is not directed at children under 13 and we do not knowingly collect data from children."))
        }
    }

    private var section8: some View {
        Group {
            h2("8. Changes to this policy")
            paragraph(plain("If we materially change how we handle data, we will update the date at the top of this page and, where required by law, give notice in the app. The current version is always the canonical one."))
        }
    }

    private var section9: some View {
        Group {
            h2("9. Contact")
            paragraph(plain("Email ") + inkLink("levin.schwab@gmx.de", "mailto:levin.schwab@gmx.de") + plain(" for any privacy question."))
                .padding(.bottom, 16)
        }
    }

    // MARK: - Block helpers (web: h2 mt-12 mb-4 serif 2xl; p/ul my-4 lg leading-relaxed;
    // adjacent vertical margins collapse, so blocks carry only their collapsed TOP gap)

    private func h2(_ text: String) -> some View {
        Text(text)
            .font(.rrSerif(24, weight: .medium))
            .foregroundStyle(RR.ink)
            .padding(.top, 48)
    }

    private func paragraph(_ content: AttributedString) -> some View {
        Text(content)
            .font(.rrSans(18))
            .lineSpacing(7)
            .foregroundStyle(RR.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
    }

    /// list-disc space-y-2 pl-6 → bullet gutter 24pt, 8pt item spacing.
    private func bulletList(_ items: [AttributedString]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 0) {
                    Text("•")
                        .font(.rrSans(18))
                        .foregroundStyle(RR.inkSoft)
                        .frame(width: 24, alignment: .center)
                    Text(item)
                        .font(.rrSans(18))
                        .lineSpacing(7)
                        .foregroundStyle(RR.inkSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.top, 16)
    }

    // MARK: - Inline-run helpers

    private func plain(_ s: String) -> AttributedString {
        AttributedString(s)
    }

    private func strong(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        a.font = .rrSans(18, weight: .semibold)
        a.foregroundColor = RR.ink
        return a
    }

    /// Web: text-ink underline decoration-amber underline-offset-4.
    /// SwiftUI AttributedString underline follows the run's foreground color,
    /// so the underline renders ink (amber decoration not expressible per-run).
    private func inkLink(_ s: String, _ url: String) -> AttributedString {
        var a = AttributedString(s)
        a.foregroundColor = RR.ink
        a.underlineStyle = .single
        a.link = URL(string: url)
        return a
    }
}

#Preview {
    PrivacyView()
}
