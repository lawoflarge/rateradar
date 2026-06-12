import SwiftUI

/// Port of apps/web/src/app/compare/page.tsx — the Fed vs ECB divergence
/// tracker. Mobile rendering: the md:grid-cols-3 headline band and the
/// md:grid-cols-2 curve grid render STACKED single-column.
struct CompareView: View {
    @Environment(AppDataStore.self) private var store
    @Environment(Router.self) private var router

    /// Preview-only fixture overrides; the live app reads the environment store.
    var fixtureFed: [MeetingProbabilities]? = nil
    var fixtureEcb: [MeetingProbabilities]? = nil

    private var fed: [MeetingProbabilities] { fixtureFed ?? store.fed }
    private var ecb: [MeetingProbabilities] { fixtureEcb ?? store.ecb }

    /// sumExpected from compare/page.tsx: Σ over meetings of Σ p·Δ (bps).
    private var fedCumBps: Double { fed.reduce(0) { $0 + RateMath.expectedDeltaBps($1) } }
    private var ecbCumBps: Double { ecb.reduce(0) { $0 + RateMath.expectedDeltaBps($1) } }
    private var divergenceBps: Double { fedCumBps - ecbCumBps }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                RRRule()
                divergenceBand
                RRRule(tone: .soft)
                pathsSection
                RRRule(tone: .soft)
                curvesSection
                RRRule()
                footer
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Divergence tracker")
            Text("Fed vs ECB")
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
                .padding(.top, 16)
            Text("Compare market-implied probabilities and forward rate paths for the Federal Reserve and the European Central Bank. A growing divergence often signals shifting global macro expectations.")
                .font(.rrSans(18))
                .lineSpacing(7)
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24)
        }
        .padding(.bottom, 48)
    }

    // MARK: - Divergence headline: rule-separated columns, no cards

    private var divergenceBand: some View {
        VStack(alignment: .leading, spacing: 32) {
            metric(
                label: "Fed pricing",
                value: fedCumBps,
                valueColor: RR.ink,
                caption: "cumulative expected change"
            )
            metric(
                label: "ECB pricing",
                value: ecbCumBps,
                valueColor: RR.ink,
                caption: "cumulative expected change"
            )
            metric(
                label: "Divergence (Fed − ECB)",
                value: divergenceBps,
                valueColor: RR.cut,
                caption: divergenceCaption
            )
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1)
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1)
        }
        .padding(.vertical, 48)
    }

    private var divergenceCaption: String {
        if divergenceBps < 0 { return "Fed is priced more dovishly than ECB" }
        if divergenceBps > 0 { return "Fed is priced more hawkishly than ECB" }
        return "Both banks priced equally"
    }

    private func metric(
        label: String, value: Double, valueColor: Color, caption: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(label)
            (
                Text("\(value >= 0 ? "+" : "")\(String(format: "%.0f", value))")
                    .font(.rrMono(30, weight: .medium))
                + Text(" bps")
                    .font(.rrSerif(30, weight: .medium))
            )
            .foregroundStyle(valueColor)
            .padding(.top, 8)
            Text(caption)
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)
                .padding(.top, 4)
        }
    }

    // MARK: - Paths

    private var pathsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Most-likely paths")
            Text("Cumulative expected changes by meeting")
                .font(.rrSerif(24, weight: .medium))
                .foregroundStyle(RR.ink)
                .padding(.top, 8)
            VStack(alignment: .leading, spacing: 32) {
                MostLikelyPathView(snapshots: fed, label: "Fed most-likely path")
                MostLikelyPathView(snapshots: ecb, label: "ECB most-likely path")
            }
            .padding(.top, 24)
        }
        .padding(.vertical, 48)
    }

    // MARK: - Implied rate curves side by side

    private var curvesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Implied rate curves")
            Text("Forward path side by side")
                .font(.rrSerif(24, weight: .medium))
                .foregroundStyle(RR.ink)
                .padding(.top, 8)
            VStack(alignment: .leading, spacing: 32) {
                ImpliedRateCurveView(
                    snapshots: fed,
                    startingRate: RateMath.currentPolicyRates[.fed] ?? 0,
                    bankLabel: "Federal Reserve"
                )
                ImpliedRateCurveView(
                    snapshots: ecb,
                    startingRate: RateMath.currentPolicyRates[.ecb] ?? 0,
                    bankLabel: "European Central Bank"
                )
            }
            .padding(.top, 24)
        }
        .padding(.vertical, 48)
    }

    // MARK: - Footer

    private var footer: some View {
        Text(Self.footerText)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .tint(RR.cut)
            .environment(\.openURL, OpenURLAction { _ in
                router.navigate(.methodology)
                return .handled
            })
            .padding(.top, 72) // mt-10 + pt-8
    }

    private static var footerText: AttributedString {
        var text = AttributedString(
            "Cumulative expected change = Σ (pᵢ × Δᵢ) over all upcoming meetings. Positive = rate hikes priced in; negative = cuts. See "
        )
        var link = AttributedString("methodology")
        link.link = URL(string: "https://rateradar-web.vercel.app/methodology")
        link.foregroundColor = RR.cut
        text += link
        text += AttributedString(".")
        return text
    }
}

#Preview {
    let fed = [
        MeetingProbabilities(
            meeting: Meeting(
                id: "FED-2026-07-29", bankCode: .fed,
                meetingDate: "2026-07-29", status: .scheduled
            ),
            outcomes: [
                Outcome(id: "f1-cut", label: "-25bp", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
                Outcome(id: "f1-hold", label: "Hold", deltaBps: 0, probability: 0.38, postMeetingRate: 3.625),
            ],
            snapshotAt: "2026-06-12T12:00:00Z"
        ),
        MeetingProbabilities(
            meeting: Meeting(
                id: "FED-2026-09-16", bankCode: .fed,
                meetingDate: "2026-09-16", status: .scheduled
            ),
            outcomes: [
                Outcome(id: "f2-cut", label: "-25bp", deltaBps: -25, probability: 0.41, postMeetingRate: 3.125),
                Outcome(id: "f2-hold", label: "Hold", deltaBps: 0, probability: 0.59, postMeetingRate: 3.375),
            ],
            snapshotAt: "2026-06-12T12:00:00Z"
        ),
    ]
    let ecb = [
        MeetingProbabilities(
            meeting: Meeting(
                id: "ECB-2026-07-23", bankCode: .ecb,
                meetingDate: "2026-07-23", status: .scheduled
            ),
            outcomes: [
                Outcome(id: "e1-hold", label: "Hold", deltaBps: 0, probability: 0.81, postMeetingRate: 2.0),
                Outcome(id: "e1-cut", label: "-25bp", deltaBps: -25, probability: 0.19, postMeetingRate: 1.75),
            ],
            snapshotAt: "2026-06-12T12:00:00Z"
        ),
    ]
    NavigationStack {
        CompareView(fixtureFed: fed, fixtureEcb: ecb)
    }
    .environment(AppDataStore())
    .environment(Router())
}
