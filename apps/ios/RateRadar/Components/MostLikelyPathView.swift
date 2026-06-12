import SwiftUI

/// Port of apps/web/src/components/MostLikelyPath.tsx.
///
/// Most-likely outcome at each upcoming meeting, chained in order, with the
/// running cumulative expected bps change via `RateMath.pathEntries`.
struct MostLikelyPathView: View {
    @Environment(Router.self) private var router

    let snapshots: [MeetingProbabilities]
    var label: String = "Most-likely path"
    var maxMeetings: Int = 8

    var body: some View {
        // Web: `if (snapshots.length === 0) return null;`
        if !snapshots.isEmpty {
            card
        }
    }

    private var card: some View {
        let entries = RateMath.pathEntries(snapshots, maxMeetings: maxMeetings)
        let finalCumulative = entries.last?.cumulative ?? 0
        let finalDate = entries.last.map {
            RateMath.shortDate($0.snapshot.meeting.meetingDate)
        } ?? ""

        // rounded-none border border-ink/15 bg-cream-soft p-6
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(label)
                        .font(.rrSans(12))
                        .textCase(.uppercase)
                        .tracking(0.4)
                        .foregroundStyle(RR.inkMute)

                    Text("Most-likely outcome at each upcoming meeting, chained in order.")
                        .font(.rrSans(14))
                        .foregroundStyle(RR.inkMute)
                        .padding(.top, 4)
                }

                Spacer(minLength: 16)

                VStack(alignment: .trailing, spacing: 0) {
                    Text("Cumulative pricing")
                        .font(.rrSans(12))
                        .textCase(.uppercase)
                        .tracking(0.4)
                        .foregroundStyle(RR.inkMute)

                    Text("\(finalCumulative >= 0 ? "+" : "")\(String(format: "%.0f", finalCumulative)) bps by \(finalDate)")
                        .font(.rrMono(18, weight: .semibold))
                        .foregroundStyle(RR.cut)
                        .padding(.top, 4)
                }
                .multilineTextAlignment(.trailing)
            }
            .padding(.bottom, 16)

            // flex flex-wrap items-stretch gap-2
            WrappingHStack(spacing: 8, lineSpacing: 8) {
                ForEach(
                    Array(entries.enumerated()), id: \.element.snapshot.meeting.id
                ) { index, entry in
                    HStack(spacing: 0) {
                        chip(for: entry)
                        if index < entries.count - 1 {
                            Text("→")
                                .font(.rrSans(16))
                                .foregroundStyle(RR.ink.opacity(0.25))
                                .padding(.horizontal, 4)
                                .accessibilityHidden(true)
                        }
                    }
                }
            }
        }
        .padding(24)
        .background(RR.creamSoft)
        .overlay(Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1))
    }

    /// One 104pt chip: outcomeColor() — strong (p ≥ 0.5) tone border + tone
    /// text; otherwise faded border ink/25 + tone text at 70%.
    @ViewBuilder
    private func chip(for entry: RateMath.PathEntry) -> some View {
        if let top = entry.snapshot.topOutcome {
            let strong = top.probability >= 0.5
            let tone = Tone(deltaBps: top.deltaBps).color
            let toneText = strong ? tone : tone.opacity(0.7)
            let border = strong ? tone : RR.ink.opacity(0.25)

            Button {
                router.navigate(.meeting(entry.snapshot.meeting.id))
            } label: {
                VStack(spacing: 0) {
                    Text(entry.snapshot.meeting.bankCode.rawValue)
                        .font(.rrSans(10))
                        .textCase(.uppercase)
                        .tracking(0.4)
                        .foregroundStyle(toneText.opacity(0.8))

                    Text(RateMath.shortDate(entry.snapshot.meeting.meetingDate))
                        .font(.rrSans(12, weight: .medium))
                        .foregroundStyle(RR.ink)
                        .padding(.top, 2)

                    Text(top.label)
                        .font(.rrMono(14, weight: .semibold))
                        .foregroundStyle(toneText)
                        .padding(.top, 8)

                    Text(String(format: "%.0f%%", top.probability * 100))
                        .font(.rrMono(11))
                        .foregroundStyle(RR.inkMute)
                        .padding(.top, 2)

                    Text("Σ \(entry.cumulative >= 0 ? "+" : "")\(String(format: "%.0f", entry.cumulative))bp")
                        .font(.rrMono(10))
                        .foregroundStyle(RR.inkMute)
                        .padding(.top, 8)
                }
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .frame(width: 104)
                .background(RR.creamSoft)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }
}

#Preview {
    let june = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-06-17", bankCode: .fed,
            meetingDate: "2026-06-17", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o1", label: "-25 bps", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
            Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.38, postMeetingRate: 3.625),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )
    let july = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-07-29", bankCode: .fed,
            meetingDate: "2026-07-29", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o3", label: "-25 bps", deltaBps: -25, probability: 0.44, postMeetingRate: 3.125),
            Outcome(id: "o4", label: "Hold", deltaBps: 0, probability: 0.56, postMeetingRate: 3.375),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )
    let september = MeetingProbabilities(
        meeting: Meeting(
            id: "FED-2026-09-16", bankCode: .fed,
            meetingDate: "2026-09-16", status: .scheduled
        ),
        outcomes: [
            Outcome(id: "o5", label: "+25 bps", deltaBps: 25, probability: 0.41, postMeetingRate: 3.625),
            Outcome(id: "o6", label: "Hold", deltaBps: 0, probability: 0.59, postMeetingRate: 3.375),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )

    ScrollView {
        MostLikelyPathView(snapshots: [june, july, september])
            .padding(24)
    }
    .background(RR.cream)
    .environment(Router())
}
