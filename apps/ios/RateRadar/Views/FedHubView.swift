import SwiftUI

/// 1:1 port of apps/web/src/app/fed/page.tsx (mobile rendering).
/// JsonLd / metadata / AdSlot are omitted per the rebuild contract.
struct FedHubView: View {
    @Environment(AppDataStore.self) private var store

    var body: some View {
        FedHubContent(meetings: store.fed)
            .task { if !store.hasLoaded { await store.loadAll() } }
    }
}

private struct FedHubContent: View {
    @Environment(Router.self) private var router

    let meetings: [MeetingProbabilities]

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

    /// summarize() from page.tsx.
    private var summary: String {
        guard let next, let top = next.topOutcome else {
            return "The next FOMC meeting date will appear here once scheduled."
        }
        let pct = Int((top.probability * 100).rounded())
        let action = top.label == "Hold" ? "hold rates" : "move \(top.label)"
        return "Markets price a \(pct)% chance the Fed will \(action) at the \(Self.shortDate(next.meeting.meetingDate)) meeting."
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                RRRule()
                    .padding(.top, 48) // header mb-12

                if let next {
                    outcomeSection(next)
                }

                RRRule(tone: .soft)
                    .padding(.top, next == nil ? 0 : 48) // section my-12

                upcomingSection

                // Ad section (my-10) renders nothing natively; margins collapse.
                RRRule()
                    .padding(.top, 48)

                footer
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Header

    @ViewBuilder private var header: some View {
        SectionLabel("Federal Reserve (FOMC)")

        Text(next.map { "Next FOMC Meeting: \(RateMath.longDate($0.meeting.meetingDate))" }
            ?? "Next FOMC Meeting")
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

    // MARK: - Next meeting · outcome distribution

    @ViewBuilder private func outcomeSection(_ next: MeetingProbabilities) -> some View {
        SectionLabel("Next meeting · outcome distribution")
            .padding(.top, 48) // section my-12

        Text("Will the Fed cut rates on \(Self.shortDate(next.meeting.meetingDate))?")
            .font(.rrSerif(30, weight: .medium))
            .foregroundStyle(RR.ink)
            .padding(.top, 8) // mt-2

        ProbabilityTableView(snapshot: next, showDetailLink: false)
            .padding(.top, 24) // h2 mb-6

        Button {
            router.navigate(.meeting(next.meeting.id))
        } label: {
            Text("Full history & detail →")
                .font(.rrSans(14))
                .foregroundStyle(RR.cut)
        }
        .buttonStyle(.plain)
        .padding(.top, 16) // mt-4
    }

    // MARK: - Upcoming meetings list

    @ViewBuilder private var upcomingSection: some View {
        SectionLabel("Upcoming \(year) FOMC meetings")
            .padding(.top, 48) // section my-12

        let rows = upcoming.compactMap { m in m.topOutcome.map { (snapshot: m, top: $0) } }
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.snapshot.id) { index, row in
                if index > 0 {
                    Rectangle()
                        .fill(RR.ink.opacity(0.10)) // divide-y divide-ink/10
                        .frame(height: 1)
                }
                Button {
                    router.navigate(.meeting(row.snapshot.meeting.id))
                } label: {
                    HStack(alignment: .center) {
                        Text(RateMath.longDate(row.snapshot.meeting.meetingDate))
                            .font(.rrSans(16, weight: .medium))
                            .multilineTextAlignment(.leading)
                            .foregroundStyle(RR.ink)
                        Spacer(minLength: 8)
                        Text("\(row.top.label) · \(Int((row.top.probability * 100).rounded()))%")
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
        var s = AttributedString("Probabilities are computed from Fed Funds futures and update twice per business day. See ")
        var link = AttributedString("methodology")
        link.link = URL(string: "rateradar://methodology")
        link.foregroundColor = RR.cut
        s += link
        s += AttributedString(". Not financial advice.")
        return s
    }

    // MARK: - Date helpers (page.tsx formatShortDate: "Jun 17, 2026")

    private static func makeFormatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = format
        return f
    }

    private static let isoDayF = makeFormatter("yyyy-MM-dd")
    private static let shortDateF = makeFormatter("MMM d, yyyy")

    private static func shortDate(_ isoDay: String) -> String {
        guard let d = isoDayF.date(from: isoDay) else { return isoDay }
        return shortDateF.string(from: d)
    }
}

#Preview {
    let m1 = MeetingProbabilities(
        meeting: Meeting(id: "FED-2026-06-17", bankCode: .fed, meetingDate: "2026-06-17", status: .scheduled),
        outcomes: [
            Outcome(id: "o1", label: "-25 bps", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
            Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.31, postMeetingRate: 3.625),
            Outcome(id: "o3", label: "-50 bps", deltaBps: -50, probability: 0.07, postMeetingRate: 3.125),
        ],
        snapshotAt: "2026-06-12T06:00:00Z"
    )
    let m2 = MeetingProbabilities(
        meeting: Meeting(id: "FED-2026-07-29", bankCode: .fed, meetingDate: "2026-07-29", status: .scheduled),
        outcomes: [
            Outcome(id: "o4", label: "Hold", deltaBps: 0, probability: 0.55, postMeetingRate: 3.375),
            Outcome(id: "o5", label: "-25 bps", deltaBps: -25, probability: 0.45, postMeetingRate: 3.125),
        ],
        snapshotAt: "2026-06-12T06:00:00Z"
    )
    return NavigationStack {
        FedHubContent(meetings: [m1, m2])
    }
    .environment(Router())
    .environment(AppDataStore())
}
