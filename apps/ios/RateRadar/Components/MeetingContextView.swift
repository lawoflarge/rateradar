import SwiftUI

/// Port of apps/web/src/components/MeetingContext.tsx.
///
/// The web receives `prior`/`next` precomputed server-side by
/// lib/data.ts getMeetingContext (same-bank snapshots sorted by meeting date,
/// neighbors of the current meeting). Natively we derive them from the
/// store's snapshots passed in as `all` — identical semantics, since only
/// upcoming meetings are tracked.
struct MeetingContextView: View {
    let current: MeetingProbabilities
    let all: [MeetingProbabilities]

    @Environment(Router.self) private var router

    private var neighbors: (prior: MeetingProbabilities?, next: MeetingProbabilities?) {
        let sorted = all
            .filter { $0.meeting.bankCode == current.meeting.bankCode }
            .sorted { $0.meeting.meetingDate < $1.meeting.meetingDate }
        guard let idx = sorted.firstIndex(where: { $0.meeting.id == current.meeting.id }) else {
            return (nil, nil)
        }
        return (
            idx > 0 ? sorted[idx - 1] : nil,
            idx < sorted.count - 1 ? sorted[idx + 1] : nil
        )
    }

    var body: some View {
        let (prior, next) = neighbors
        if prior != nil || next != nil {
            VStack(alignment: .leading, spacing: 0) {
                Text("Path context")
                    .font(.rrSans(12))
                    .tracking(0.4)
                    .textCase(.uppercase)
                    .foregroundStyle(RR.inkMute)
                    .padding(.bottom, 12)

                HStack(alignment: .top, spacing: 12) {
                    if let prior {
                        MiniCard(label: "Prior meeting", data: prior)
                    } else {
                        placeholder("No earlier tracked meeting for this bank.")
                    }
                    if let next {
                        MiniCard(label: "Next meeting", data: next)
                    } else {
                        placeholder("No later tracked meeting for this bank.")
                    }
                }
                .fixedSize(horizontal: false, vertical: true)

                Text(footnote)
                    .font(.rrSans(12))
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 12)
                    .environment(\.openURL, OpenURLAction { _ in
                        router.navigate(.methodology)
                        return .handled
                    })
            }
            .padding(20)
            .background(RR.creamSoft)
            .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
        }
    }

    private func placeholder(_ text: String) -> some View {
        Text(text)
            .font(.rrSans(14))
            .foregroundStyle(RR.inkMute)
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(
                Rectangle().strokeBorder(
                    RR.ink.opacity(0.15),
                    style: StrokeStyle(lineWidth: 1, dash: [4])
                )
            )
    }

    /// "See methodology for the full derivation." — the inline link routes
    /// natively to the methodology screen via OpenURLAction.
    private var footnote: AttributedString {
        var s = AttributedString(
            "Market-implied probabilities chain meeting-to-meeting. Today's odds already account for the most-likely outcome of prior meetings. See "
        )
        var link = AttributedString("methodology")
        link.link = URL(string: "rateradar://methodology")
        link.foregroundColor = RR.inkSoft
        s += link
        s += AttributedString(" for the full derivation.")
        return s
    }
}

private struct MiniCard: View {
    let label: String
    let data: MeetingProbabilities

    @Environment(Router.self) private var router

    var body: some View {
        Button {
            router.navigate(.meeting(data.meeting.id))
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(.rrSans(12))
                    .tracking(0.4)
                    .textCase(.uppercase)
                    .foregroundStyle(RR.inkMute)
                Text(RateMath.shortDate(data.meeting.meetingDate))
                    .font(.rrSans(18, weight: .semibold))
                    .foregroundStyle(RR.ink)
                    .padding(.top, 4)
                if let top = data.topOutcome {
                    HStack(spacing: 4) {
                        Text(top.label)
                            .font(.rrMono(14))
                            .foregroundStyle(RR.ink)
                        Text("·")
                            .font(.rrSans(14))
                            .foregroundStyle(RR.inkMute)
                        Text("\(Int((top.probability * 100).rounded()))%")
                            .font(.rrMono(14))
                            .foregroundStyle(RR.inkMute)
                    }
                    .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(20)
            .background(RR.creamSoft)
            .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    let outcomesCutLean: [Outcome] = [
        Outcome(id: "o1", label: "-25 bps", deltaBps: -25, probability: 0.64, postMeetingRate: 3.375),
        Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.36, postMeetingRate: 3.625),
    ]
    let outcomesHoldLean: [Outcome] = [
        Outcome(id: "o3", label: "Hold", deltaBps: 0, probability: 0.58, postMeetingRate: 3.625),
        Outcome(id: "o4", label: "-25 bps", deltaBps: -25, probability: 0.42, postMeetingRate: 3.375),
    ]
    let m1 = MeetingProbabilities(
        meeting: Meeting(id: "FED-2026-06-17", bankCode: .fed, meetingDate: "2026-06-17", status: .scheduled),
        outcomes: outcomesCutLean,
        snapshotAt: "2026-06-12T08:00:00Z"
    )
    let m2 = MeetingProbabilities(
        meeting: Meeting(id: "FED-2026-07-29", bankCode: .fed, meetingDate: "2026-07-29", status: .scheduled),
        outcomes: outcomesHoldLean,
        snapshotAt: "2026-06-12T08:00:00Z"
    )
    let m3 = MeetingProbabilities(
        meeting: Meeting(id: "FED-2026-09-16", bankCode: .fed, meetingDate: "2026-09-16", status: .scheduled),
        outcomes: outcomesCutLean,
        snapshotAt: "2026-06-12T08:00:00Z"
    )

    return ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            MeetingContextView(current: m2, all: [m1, m2, m3])
            MeetingContextView(current: m1, all: [m1, m2, m3])
        }
        .padding(24)
    }
    .background(RR.cream)
    .environment(Router())
}
