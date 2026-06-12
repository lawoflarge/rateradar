import SwiftUI

/// 1:1 port of apps/web/src/app/ecb/page.tsx (mobile rendering).
/// JsonLd / metadata / AdSlot are omitted per the rebuild contract.
/// The key-facts band uses `sm:grid-cols-2` on the web, so it renders
/// STACKED single-column at iPhone width (sm: variants do not apply).
struct ECBHubView: View {
    @Environment(AppDataStore.self) private var store

    var body: some View {
        ECBHubContent(meetings: store.ecb)
            .task { if !store.hasLoaded { await store.loadAll() } }
    }
}

private struct ECBHubContent: View {
    @Environment(Router.self) private var router

    let meetings: [MeetingProbabilities]

    /// lib/policy-rates.ts CURRENT_ECB_RATE_PCT — "2.00%".
    private static let currentEcbRatePct = String(
        format: "%.2f%%", RateMath.currentPolicyRates[.ecb] ?? 2.0
    )

    /// lib/policy-rates.ts CURRENT_POLICY_RATE_LABELS.ECB.
    private static let currentEcbRateLabel =
        RateMath.currentPolicyRateLabels[.ecb] ?? "ECB Deposit Facility Rate 2.00%"

    // MARK: - Derived data (page.tsx + lib/data.ts pickNextMeeting)

    private var upcoming: [MeetingProbabilities] {
        let todayISO = Self.isoDayF.string(from: Date())
        return meetings
            .filter { $0.meeting.meetingDate >= todayISO }
            .sorted { $0.meeting.meetingDate < $1.meeting.meetingDate }
    }

    private var next: MeetingProbabilities? { upcoming.first }

    private var year: Int {
        if let next, let y = Int(next.meeting.meetingDate.prefix(4)) { return y }
        return Calendar.current.component(.year, from: Date())
    }

    private var summary: String {
        var s = "The ECB Governing Council sets the Deposit Facility Rate, currently \(Self.currentEcbRatePct)."
        if let next {
            s += " The next decision is on \(RateMath.longDate(next.meeting.meetingDate))."
        }
        return s
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                RRRule()
                    .padding(.top, 48) // header mb-12

                keyFactsBand
                    .padding(.top, 40) // section my-10

                RRRule(tone: .soft)
                    .padding(.top, 40)

                upcomingSection

                // Ad section (my-10) renders nothing natively; margins collapse.
                RRRule()
                    .padding(.top, 48) // section my-12

                footer
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header

    @ViewBuilder private var header: some View {
        SectionLabel("European Central Bank (Governing Council)")

        Text(next.map { "Next ECB Meeting: \(RateMath.longDate($0.meeting.meetingDate))" }
            ?? "Next ECB Meeting")
            .font(.rrSerif(48, weight: .medium))
            .tracking(-0.5)
            .foregroundStyle(RR.ink)
            .padding(.top, 12) // mt-3

        Text(summary)
            .font(.rrSans(18))
            .lineSpacing(8) // leading-relaxed
            .foregroundStyle(RR.inkSoft)
            .padding(.top, 24) // mt-6

        if let next {
            MeetingCountdownView(meetingDate: next.meeting.meetingDate)
                .foregroundStyle(RR.inkMute)
                .padding(.top, 16) // mt-4
        }
    }

    // MARK: - Key facts band (grid gap-8 border-y border-ink/15 py-8; stacked on mobile)

    private var keyFactsBand: some View {
        VStack(alignment: .leading, spacing: 32) { // gap-8
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Current rate")
                Text(Self.currentEcbRatePct)
                    .font(.rrSerif(24, weight: .medium))
                    .foregroundStyle(RR.ink)
                    .padding(.top, 8) // mt-2
                Text(Self.currentEcbRateLabel)
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 4) // mt-1
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Forward odds")
                Text("Spot-anchored — market-implied forward probabilities for the ECB are not yet available (no free forward-rate source).")
                    .font(.rrSans(16))
                    .foregroundStyle(RR.inkSoft)
                    .padding(.top, 8) // mt-2
                Button {
                    router.navigate(.methodology)
                } label: {
                    Text("How we calculate →")
                        .font(.rrSans(14))
                        .foregroundStyle(RR.cut)
                }
                .buttonStyle(.plain)
                .padding(.top, 8) // mt-2
            }
        }
        .padding(.vertical, 32) // py-8
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1) // border-y border-ink/15
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1)
        }
    }

    // MARK: - Upcoming meetings list

    @ViewBuilder private var upcomingSection: some View {
        SectionLabel("Upcoming \(year) ECB meetings")
            .padding(.top, 48) // section my-12

        VStack(spacing: 0) {
            ForEach(Array(upcoming.enumerated()), id: \.element.id) { index, m in
                if index > 0 {
                    Rectangle()
                        .fill(RR.ink.opacity(0.10)) // divide-y divide-ink/10
                        .frame(height: 1)
                }
                Button {
                    router.navigate(.meeting(m.meeting.id))
                } label: {
                    HStack(alignment: .center) {
                        Text(RateMath.longDate(m.meeting.meetingDate))
                            .font(.rrSans(16, weight: .medium))
                            .multilineTextAlignment(.leading)
                            .foregroundStyle(RR.ink)
                        Spacer(minLength: 8)
                        Text("View →")
                            .font(.rrMono(14))
                            .foregroundStyle(RR.inkMute)
                    }
                    .padding(.vertical, 12) // py-3
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 16) // mt-4
    }

    // MARK: - Footer

    private var footer: some View {
        Text(Self.footerText)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .padding(.top, 72) // mt-10 + pt-8
            .environment(\.openURL, OpenURLAction { _ in
                router.navigate(.methodology)
                return .handled
            })
    }

    private static var footerText: AttributedString {
        var s = AttributedString("ECB tracking is spot-anchored at the current Deposit Facility Rate. See ")
        var link = AttributedString("methodology")
        link.link = URL(string: "rateradar://methodology")
        link.foregroundColor = RR.cut
        s += link
        s += AttributedString(". Not financial advice.")
        return s
    }

    // MARK: - Date helpers

    private static let isoDayF: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}

#Preview {
    let m1 = MeetingProbabilities(
        meeting: Meeting(id: "ECB-2026-07-23", bankCode: .ecb, meetingDate: "2026-07-23", status: .scheduled),
        outcomes: [
            Outcome(id: "e1", label: "Hold", deltaBps: 0, probability: 1.0, postMeetingRate: 2.0)
        ],
        snapshotAt: "2026-06-12T06:00:00Z"
    )
    let m2 = MeetingProbabilities(
        meeting: Meeting(id: "ECB-2026-09-10", bankCode: .ecb, meetingDate: "2026-09-10", status: .scheduled),
        outcomes: [
            Outcome(id: "e2", label: "Hold", deltaBps: 0, probability: 1.0, postMeetingRate: 2.0)
        ],
        snapshotAt: "2026-06-12T06:00:00Z"
    )
    return NavigationStack {
        ECBHubContent(meetings: [m1, m2])
    }
    .environment(Router())
    .environment(AppDataStore())
}
