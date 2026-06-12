import SwiftUI

/// 1:1 port of apps/web/src/app/brokers/page.tsx (mobile rendering).
/// Static affiliate-brokers page: serif H1, amber partnership notice band,
/// four broker articles, affiliate disclaimer footer.
struct BrokersView: View {

    private struct Broker {
        let slug: String
        let name: String
        let tagline: String
        let markets: [String]
        let notes: String
    }

    // Placeholders — real affiliate URLs + creatives to be wired once partner
    // programs are approved (mirrors the BROKERS constant in the web source).
    private static let brokers: [Broker] = [
        Broker(
            slug: "interactive-brokers",
            name: "Interactive Brokers",
            tagline: "Global pro-grade access to Fed Funds Futures, Treasuries, and OIS.",
            markets: ["US", "EU", "UK", "Global"],
            notes: "Best for active traders; low commissions, deep instrument coverage."
        ),
        Broker(
            slug: "trading212",
            name: "Trading 212",
            tagline: "Commission-free equity + ETF investing for retail Europe.",
            markets: ["EU", "UK"],
            notes: "Good for macro-themed ETFs (TLT equivalents). No futures."
        ),
        Broker(
            slug: "etoro",
            name: "eToro",
            tagline: "Social trading with CFD access to rate-sensitive pairs.",
            markets: ["EU", "UK", "Global"],
            notes: "CFDs only. Good for EUR/USD moves around ECB/Fed decisions."
        ),
        Broker(
            slug: "plus500",
            name: "Plus500",
            tagline: "CFD trading on bond futures and currency pairs.",
            markets: ["EU", "UK", "Global"],
            notes: "CFDs; high-risk. Check regional availability."
        ),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                noticeBand

                RRRule()

                ForEach(Array(Self.brokers.enumerated()), id: \.element.slug) { index, broker in
                    brokerArticle(broker, isLast: index == Self.brokers.count - 1)
                }

                RRRule()

                footer
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header (mb-10)

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Trade what you see")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)

            Text("RateRadar is free because of transparent broker partnerships. These are reputable, regulated brokers where you can act on the rate-expectation shifts this site surfaces.")
                .font(.rrSans(18))
                .lineSpacing(7) // leading-relaxed
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)
        }
        .padding(.bottom, 40)
    }

    // MARK: - Partnership notice band (border-y cut/40, bg cut/10)

    private var noticeBand: some View {
        (
            Text("Partnership status:")
                .font(.rrSans(14, weight: .semibold))
                .foregroundStyle(RR.ink)
            + Text(" approvals in progress. Links below are placeholders until affiliate IDs are live. This is not financial advice; trade at your own risk and verify regulation in your region.")
                .font(.rrSans(14))
                .foregroundStyle(RR.inkSoft)
        )
        .lineSpacing(3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(RR.cut.opacity(0.10))
        .overlay(alignment: .top) {
            Rectangle().fill(RR.cut.opacity(0.4)).frame(height: 1)
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(RR.cut.opacity(0.4)).frame(height: 1)
        }
        .padding(.bottom, 40)
    }

    // MARK: - Broker article (py-8)

    private func brokerArticle(_ broker: Broker, isLast: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // flex flex-wrap items-baseline justify-between gap-3
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    brokerName(broker.name)
                    Spacer(minLength: 12)
                    marketChips(broker.markets)
                }
                VStack(alignment: .leading, spacing: 12) {
                    brokerName(broker.name)
                    marketChips(broker.markets)
                }
            }

            Text(broker.tagline)
                .font(.rrSans(18))
                .lineSpacing(7) // leading-relaxed
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 8)

            Text(broker.notes)
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)
                .padding(.top, 8)

            Text("Link coming soon →")
                .font(.rrSans(16))
                .foregroundStyle(RR.cut)
                .padding(.top, 16)

            if !isLast {
                RRRule(tone: .soft)
                    .padding(.top, 32)
            }
        }
        .padding(.vertical, 32)
    }

    private func brokerName(_ name: String) -> some View {
        Text(name)
            .font(.rrSerif(20, weight: .medium))
            .foregroundStyle(RR.ink)
    }

    private func marketChips(_ markets: [String]) -> some View {
        HStack(spacing: 4) {
            ForEach(markets, id: \.self) { market in
                Text(market)
                    .font(.rrMono(10))
                    .textCase(.uppercase)
                    .tracking(0.5) // tracking-wider
                    .foregroundStyle(RR.inkMute)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .overlay(
                        Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Affiliate disclaimer footer (mt-10 pt-8)

    private var footer: some View {
        Text("Links on this page will be affiliate links once programs are approved. RateRadar may receive a commission if you sign up, at no cost to you. We only partner with regulated brokers we would use ourselves.")
            .font(.rrSans(14))
            .lineSpacing(3)
            .foregroundStyle(RR.inkMute)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 72)
    }
}

#Preview {
    BrokersView()
        .environment(Router())
        .environment(AppDataStore())
}
