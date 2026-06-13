import SwiftUI

/// Port of apps/web/src/app/meeting/[id]/page.tsx (mobile rendering) plus its
/// not-found.tsx state. Looks the meeting up in AppDataStore; JsonLd/AdSlot
/// are omitted per the rebuild contract.
struct MeetingDetailView: View {
    let meetingId: String

    @Environment(AppDataStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @Environment(\.requestReview) private var requestReview

    @State private var history: [ProbabilitySeries] = []
    @State private var attemptedLoad = false

    /// Preview-only escape hatch so the #Preview can render the full layout
    /// from an inline fixture without seeding the store.
    private let previewSnapshot: MeetingProbabilities?

    init(meetingId: String) {
        self.meetingId = meetingId
        self.previewSnapshot = nil
    }

    fileprivate init(meetingId: String, previewSnapshot: MeetingProbabilities?) {
        self.meetingId = meetingId
        self.previewSnapshot = previewSnapshot
    }

    private var snapshot: MeetingProbabilities? {
        store.meeting(id: meetingId) ?? previewSnapshot
    }

    var body: some View {
        Group {
            if let snapshot {
                content(snapshot)
            } else if !attemptedLoad {
                loading
            } else {
                notFound
            }
        }
        .task {
            if !store.hasLoaded {
                await store.loadAll()
            }
            attemptedLoad = true
            history = await store.history(meetingId: meetingId, windowDays: 60)

            // Viewing an upcoming meeting is a positive moment — record it and,
            // after the user has had a beat to read the page, maybe ask for a review.
            if snapshot != nil {
                ReviewPrompt.recordMeetingViewed()
                try? await Task.sleep(for: .seconds(1.5))
                ReviewPrompt.maybeRequest(requestReview)
            }
        }
    }

    // MARK: - Page (web: <main className="mx-auto max-w-4xl px-6 py-16">)

    private func content(_ snapshot: MeetingProbabilities) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let top = snapshot.topOutcome {
                    backLink
                        .padding(.bottom, 32) // mb-8

                    hero(snapshot)
                        .padding(.bottom, 48) // mb-12

                    RRRule()

                    keyFacts(snapshot, top: top)
                        .padding(.vertical, 40) // my-10

                    RRRule(tone: .soft)

                    // Path context: prior + next meeting
                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel("Meeting context")
                        MeetingContextView(current: snapshot, all: store.all)
                            .padding(.top, 16) // mt-4
                    }
                    .padding(.vertical, 48) // my-12

                    RRRule(tone: .soft)

                    // Full probability table + chart
                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel("Full probability table")
                        Text("Outcome distribution")
                            .font(.rrSerif(30, weight: .medium))
                            .foregroundStyle(RR.ink)
                            .padding(.top, 8) // mt-2
                            .padding(.bottom, 24) // mb-6
                        ProbabilityTableView(snapshot: snapshot, showDetailLink: false)
                    }
                    .padding(.vertical, 48) // my-12

                    RRRule(tone: .soft)

                    // Share
                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel("Share")
                        ShareButtonsView(
                            meetingId: meetingId,
                            meetingDate: snapshot.meeting.meetingDate,
                            bank: snapshot.meeting.bankCode
                        )
                        .padding(.top, 16) // mt-4
                    }
                    .padding(.vertical, 48) // my-12

                    // AdSlot section omitted (contract rule 8)

                    RRRule()

                    footer
                        .padding(.top, 72) // mt-10 + pt-8
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
    }

    // MARK: - Back nav (web: ← Back to all meetings)

    private var backLink: some View {
        Button {
            dismiss()
        } label: {
            Text("← Back to all meetings")
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Hero

    private func hero(_ snapshot: MeetingProbabilities) -> some View {
        let bank = snapshot.meeting.bankCode
        return VStack(alignment: .leading, spacing: 0) {
            SectionLabel(
                bank == .fed
                    ? "Federal Reserve (FOMC)"
                    : "European Central Bank (Governing Council)"
            )
            Text(RateMath.longDate(snapshot.meeting.meetingDate))
                .font(.rrSerif(48, weight: .medium))
                .tracking(-0.5)
                .foregroundStyle(RR.ink)
                .padding(.top, 12) // mt-3
            MeetingCountdownView(meetingDate: snapshot.meeting.meetingDate)
                .foregroundStyle(RR.inkMute)
                .padding(.top, 16) // mt-4
            Text(question(snapshot))
                .font(.rrSerif(24, weight: .medium))
                .foregroundStyle(RR.inkSoft)
                .padding(.top, 24) // mt-6
        }
    }

    private func question(_ snapshot: MeetingProbabilities) -> String {
        let shortDate = Self.formatShortDate(snapshot.meeting.meetingDate)
        return snapshot.meeting.bankCode == .fed
            ? "Will the Fed cut rates on \(shortDate)?"
            : "What will the ECB decide on \(shortDate)?"
    }

    // MARK: - Key facts (web: grid gap-8 border-y border-ink/15 py-8 sm:grid-cols-3
    //         → sm: ignored on iPhone, renders stacked single-column)

    private func keyFacts(_ snapshot: MeetingProbabilities, top: Outcome) -> some View {
        let bank = snapshot.meeting.bankCode
        return VStack(alignment: .leading, spacing: 32) { // gap-8
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Most likely")
                Text(top.label == "Hold" ? "Hold rates" : "Move \(top.label)")
                    .font(.rrSerif(24, weight: .medium))
                    .foregroundStyle(RR.ink)
                    .padding(.top, 8) // mt-2
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Probability")
                Text(String(format: "%.1f%%", top.probability * 100))
                    .font(.rrMono(24, weight: .medium))
                    .foregroundStyle(RR.ink)
                    .padding(.top, 8) // mt-2
                if let deltaLabel = deltaLabel(top: top) {
                    Text(deltaLabel)
                        .font(.rrMono(12))
                        .foregroundStyle(RR.inkMute)
                        .padding(.top, 4) // mt-1
                }
            }

            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Data source")
                Text("Computed from \(bank == .fed ? "Fed Funds Futures" : "€STR OIS quotes")")
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
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1) // border-y
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(RR.ink.opacity(0.15)).frame(height: 1)
        }
    }

    /// Web: delta of the top outcome vs 30 snapshots ago, if history is long enough.
    private func deltaLabel(top: Outcome) -> String? {
        guard let topSeries = history.first(where: { $0.deltaBps == top.deltaBps }),
              topSeries.series.count > 30
        else { return nil }
        let then = topSeries.series[topSeries.series.count - 30]
        let delta = top.probability - then.probability
        guard abs(delta) > 0.01 else { return nil }
        let sign = delta >= 0 ? "+" : ""
        return "\(sign)\(RateMath.pct0(delta * 100))pp vs 30d ago"
    }

    // MARK: - Footer

    private var footer: some View {
        Text(footerText)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .environment(\.openURL, OpenURLAction { _ in
                router.navigate(.methodology)
                return .handled
            })
    }

    private var footerText: AttributedString {
        var text = AttributedString(
            "Probabilities update twice per business day (after US and European session close) and every 15 minutes on meeting days. See "
        )
        var link = AttributedString("methodology")
        link.link = URL(string: "rateradar://methodology")
        link.foregroundColor = RR.cut
        text += link
        text += AttributedString(" for the full calculation. Not financial advice.")
        return text
    }

    // MARK: - Loading (native-only interim while the store fetches)

    private var loading: some View {
        ZStack {
            RR.cream.ignoresSafeArea()
            ProgressView()
                .tint(RR.inkMute)
        }
    }

    // MARK: - Not found (web: meeting/[id]/not-found.tsx, max-w-3xl px-6 py-24)

    private var notFound: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Meeting not found")
                    .font(.rrSans(30, weight: .semibold))
                    .foregroundStyle(RR.ink)
                Text("We couldn't find a meeting with that ID. It may have been removed or the link is incorrect.")
                    .font(.rrSans(16))
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 16) // mt-4
                Button {
                    dismiss()
                } label: {
                    Text("← Back to all meetings")
                        .font(.rrSans(16))
                        .foregroundStyle(RR.cut)
                }
                .buttonStyle(.plain)
                .padding(.top, 24) // mt-6
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 96)
        }
        .background(RR.cream)
    }

    // MARK: - Dates (web formatShortDate: "Jun 17, 2026" — includes the year)

    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "MMM d, yyyy"
        return f
    }()

    private static func formatShortDate(_ isoDay: String) -> String {
        guard let d = RateMath.parseISODay(isoDay) else { return isoDay }
        return shortDateFormatter.string(from: d)
    }
}

#Preview {
    let fixture = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-06-17",
            bankCode: .fed,
            meetingDate: "2026-06-17",
            status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o1", label: "-25 bps", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
            Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.33, postMeetingRate: 3.625),
            Outcome(id: "o3", label: "+25 bps", deltaBps: 25, probability: 0.05, postMeetingRate: 3.875),
        ],
        snapshotAt: "2026-06-12T06:00:00Z"
    )
    return NavigationStack {
        MeetingDetailView(meetingId: fixture.meeting.id, previewSnapshot: fixture)
    }
    .environment(AppDataStore())
    .environment(Router())
}
