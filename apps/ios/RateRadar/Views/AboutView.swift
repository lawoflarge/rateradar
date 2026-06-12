import SwiftUI

/// Full text port of apps/web/src/app/about/page.tsx (mobile rendering).
/// Static editorial page: serif H1/H2s, lg body copy, amber inline links
/// (internal → router, external → system browser).
struct AboutView: View {
    @Environment(Router.self) private var router

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                intro
                honest
                free
                sourceCode
                notAdvice
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == "rateradar" {
                switch url.host {
                case "methodology": router.navigate(.methodology)
                case "brokers": router.navigate(.brokers)
                default: break
                }
                return .handled
            }
            return .systemAction
        })
    }

    // MARK: - Header (mb-10; h1 text-5xl serif medium tracking-tight, p mt-6 lg ink-soft)

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("About RateRadar")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
            Text("See where rates are headed. Before the meeting.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)
        }
    }

    // MARK: - Sections

    private var intro: some View {
        Group {
            paragraph(plain("Retail traders and macro-curious investors rely on two disconnected tools to read central-bank rate expectations: ") + strong("CME FedWatch") + plain(" for the Fed and ") + strong("ECB Watch") + plain(" for the ECB. Both have the same four gaps:"))
                .padding(.top, 24) // header mb-10 (40) collapsed with p my-4 → 40 total (16 + 24)
            bulletList([
                strong("No historical probability tracking.") + plain(" You see today's odds but can't see how they moved last week."),
                strong("Fragmented.") + plain(" No single product covers Fed and ECB."),
                strong("Dated UX.") + plain(" Dense tables, poor mobile, no sharing."),
                strong("No engagement loop.") + plain(" No alerts, no widgets, no iOS app."),
            ])
            paragraph(plain("RateRadar fixes all four. We combine Fed + ECB in a modern interface, expose 60 days of historical probability charts, and make every meeting snapshot shareable. Coming soon: a native iOS app with home-screen widgets and meeting-day push notifications."))
        }
    }

    private var honest: some View {
        Group {
            h2("How we stay honest")
            paragraph(plain("Every number you see is computed in-house from licensed-free futures and OIS prices, using the ") + cutLink("public CME methodology", "rateradar://methodology") + plain(". We don't scrape CME or ECB Watch. Every snapshot is validated against live data; divergences are logged and fixed."))
        }
    }

    private var free: some View {
        Group {
            h2("How we stay free")
            paragraph(plain("Ads (Google AdSense / AdMob on iOS) and transparent broker affiliate partnerships (see ") + cutLink("/brokers", "rateradar://brokers") + plain(") cover the infrastructure costs. A Pro tier with custom alerts, CSV/API export, and advanced conditional scenarios is planned for later."))
        }
    }

    private var sourceCode: some View {
        Group {
            h2("Source code")
            paragraph(plain("RateRadar is developed openly at ") + cutLink("github.com/lawoflarge/rateradar", "https://github.com/lawoflarge/rateradar") + plain(". Feedback and bug reports welcome via GitHub issues."))
        }
    }

    private var notAdvice: some View {
        Group {
            h2("Not financial advice")
            paragraph(plain("RateRadar shows what the market is pricing. It doesn't predict what central banks will actually decide. Nothing here is a recommendation to trade, invest, or change your financial plans."))
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

    /// Inline link: text-cut, underline only on hover (none on touch).
    /// Internal links use the rateradar:// scheme, intercepted by openURL above.
    private func cutLink(_ s: String, _ url: String) -> AttributedString {
        var a = AttributedString(s)
        a.foregroundColor = RR.cut
        a.link = URL(string: url)
        return a
    }
}

#Preview {
    AboutView()
        .environment(Router())
}
