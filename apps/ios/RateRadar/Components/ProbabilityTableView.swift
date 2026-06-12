import SwiftUI

// MARK: - ProbabilityTableView (ProbabilityTable.tsx)
// Card: header (long date + meeting label, "MOST LIKELY" + top outcome, Export),
// outcome table (Outcome | Probability | Moved | Post-meeting rate | bar),
// embedded HistoricalChartView, optional "View full details →" link.

struct ProbabilityTableView: View {
    let snapshot: MeetingProbabilities
    var showDetailLink: Bool = true
    /// Web parity: fed/page.tsx renders its table with history={[]} (empty
    /// chart card, no movement chips). Pass false to mirror that.
    var fetchHistory: Bool = true

    @Environment(AppDataStore.self) private var store
    @Environment(Router.self) private var router

    @State private var history: [ProbabilitySeries]?

    private var movements: RateMath.Movements? {
        RateMath.computeMovements(history: history, windowDays: 7)
    }

    var body: some View {
        // div.space-y-4 rounded-none border border-ink/15 bg-cream-soft p-6
        VStack(alignment: .leading, spacing: 16) {
            header
            table
            HistoricalChartView(history: history, isLoading: history == nil)
            if showDetailLink {
                detailLink
            }
        }
        .padding(24)
        .background(RR.creamSoft)
        .overlay(Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1))
        .task(id: snapshot.meeting.id) {
            if fetchHistory {
                history = await store.history(meetingId: snapshot.meeting.id)
            } else {
                history = []
            }
        }
    }

    // MARK: Header

    private var meetingLabel: String {
        snapshot.meeting.bankCode == .fed ? "FOMC meeting" : "ECB Governing Council"
    }

    private var header: some View {
        // flex items-baseline justify-between gap-4
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                Text(RateMath.longDate(snapshot.meeting.meetingDate))
                    .font(.rrSans(18, weight: .semibold))
                    .foregroundStyle(RR.ink)
                Text("\(meetingLabel) · \(snapshot.meeting.bankCode.rawValue)")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
            }

            Spacer(minLength: 16)

            // flex items-start gap-3
            HStack(alignment: .top, spacing: 12) {
                if let top = snapshot.topOutcome {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("Most likely")
                            .font(.rrSans(12))
                            .textCase(.uppercase)
                            .tracking(0.4)
                            .foregroundStyle(RR.inkMute)
                        Text("\(top.label) · \(RateMath.pct0(top.probability * 100))%")
                            .font(.rrMono(18, weight: .semibold))
                            .foregroundStyle(Tone(label: top.label).color)
                    }
                    .multilineTextAlignment(.trailing)
                    .frame(minWidth: 56, alignment: .trailing)
                }

                exportShareLink
            }
        }
    }

    // MARK: Export (DownloadDataButton.tsx → ShareLink, CSV)

    private var fileStem: String {
        "rateradar-\(snapshot.meeting.bankCode.rawValue.lowercased())-\(snapshot.meeting.meetingDate)"
    }

    /// CSV built exactly like DownloadDataButton.toCsv.
    private var csvText: String {
        var rows = [
            "bank,meeting_date,outcome_label,delta_bps,probability,post_meeting_rate,snapshot_at"
        ]
        for o in snapshot.outcomes {
            rows.append(
                [
                    snapshot.meeting.bankCode.rawValue,
                    snapshot.meeting.meetingDate,
                    o.label,
                    String(o.deltaBps),
                    String(format: "%.6f", o.probability),
                    String(format: "%.6f", o.postMeetingRate),
                    snapshot.snapshotAt,
                ].joined(separator: ",")
            )
        }
        return rows.joined(separator: "\n") + "\n"
    }

    private var exportShareLink: some View {
        ShareLink(item: csvText, subject: Text("\(fileStem).csv")) {
            HStack(spacing: 6) {
                Text("↓")
                Text("Export")
            }
            .font(.rrMono(11))
            .textCase(.uppercase)
            .tracking(0.4)
            .foregroundStyle(RR.inkMute)
            .fixedSize()
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(RR.cream)
            .overlay(Rectangle().stroke(RR.ink.opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Table

    private var movedHeader: String {
        guard let movements else { return "Moved" }
        let days = movements.windowDays == 0 ? 7 : movements.windowDays
        return "Moved · last \(days)d"
    }

    private var table: some View {
        Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
            GridRow {
                headCell("Outcome")
                headCell("Probability", trailing: true)
                headCell(movedHeader, trailing: true)
                headCell("Post-meeting rate", trailing: true)
                Color.clear
                    .gridCellUnsizedAxes([.horizontal, .vertical])
            }

            ForEach(Array(snapshot.outcomes.enumerated()), id: \.element.id) { index, outcome in
                GridRow {
                    Text(outcome.label)
                        .font(.rrMono(12, weight: .medium))
                        .foregroundStyle(Tone(label: outcome.label).color)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 12)

                    Text(String(format: "%.1f%%", outcome.probability * 100))
                        .font(.rrMono(14, weight: .medium))
                        .foregroundStyle(RR.ink)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 12)

                    movedCell(for: outcome)

                    Text(String(format: "%.3f%%", outcome.postMeetingRate))
                        .font(.rrMono(14))
                        .foregroundStyle(RR.inkMute)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 12)

                    barCell(for: outcome)
                }

                if index < snapshot.outcomes.count - 1 {
                    Rectangle()
                        .fill(RR.ink.opacity(0.1))
                        .frame(height: 1)
                }
            }
        }
        .background(RR.creamSoft)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RR.ink.opacity(0.15), lineWidth: 1))
    }

    private func headCell(_ text: String, trailing: Bool = false) -> some View {
        Text(text)
            .font(.rrSans(10))
            .textCase(.uppercase)
            .tracking(0.4)
            .foregroundStyle(RR.inkMute)
            .multilineTextAlignment(trailing ? .trailing : .leading)
            .lineLimit(text.contains(" ") ? 2 : 1)
            .minimumScaleFactor(0.6)
            .padding(.horizontal, 8)
            .padding(.vertical, 12)
            .gridColumnAlignment(trailing ? .trailing : .leading)
    }

    @ViewBuilder
    private func movedCell(for outcome: Outcome) -> some View {
        Group {
            if let move = movements?.byLabel[outcome.label] {
                MovementChip(deltaPp: move.deltaPp, windowDays: move.windowDays)
            } else {
                Text("·")
                    .font(.rrMono(11))
                    .foregroundStyle(RR.inkMute.opacity(0.6))
            }
        }
        .fixedSize()
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
    }

    /// actionBarColor: bg-cut/60, bg-hike/60, bg-hold/60, else bg-ink/40.
    private func barColor(for label: String) -> Color {
        let tone = Tone(label: label)
        return tone == .neutral ? RR.ink.opacity(0.4) : tone.color.opacity(0.6)
    }

    private func barCell(for outcome: Outcome) -> some View {
        GeometryReader { geo in
            Capsule()
                .fill(barColor(for: outcome.label))
                .frame(
                    width: geo.size.width * max(CGFloat(outcome.probability), 0.005),
                    height: 6
                )
        }
        .frame(height: 6)
        .frame(maxWidth: .infinity)
        .frame(minWidth: 24)
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
    }

    // MARK: Detail link

    private var detailLink: some View {
        HStack {
            Spacer()
            Button {
                router.navigate(.meeting(snapshot.meeting.id))
            } label: {
                Text("View full details →")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.cut)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - MovementChip (MovementChip.tsx)
// "▲ +4.2pp" hold / "▼ -3.1pp" cut / "· flat" mute; nil → "—".

struct MovementChip: View {
    let deltaPp: Double?
    var windowDays: Int = 7

    var body: some View {
        if let deltaPp {
            let delta = RateMath.formatDelta(deltaPp)
            if delta.sign == .flat || windowDays == 0 {
                HStack(spacing: 4) {
                    Text("·")
                    Text("flat")
                }
                .font(.rrMono(11))
                .foregroundStyle(RR.inkMute)
                .accessibilityLabel("No change since the previous snapshot")
            } else {
                HStack(spacing: 4) {
                    Text(delta.sign == .up ? "▲" : "▼")
                    Text(delta.label)
                }
                .font(.rrMono(11))
                .foregroundStyle(delta.sign == .up ? RR.hold : RR.cut)
                .accessibilityLabel("Moved \(delta.label) over \(windowDays)d")
            }
        } else {
            Text("—")
                .font(.rrMono(11))
                .foregroundStyle(RR.inkMute)
        }
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
            Outcome(id: "o1", label: "Cut 25bps", deltaBps: -25, probability: 0.62, postMeetingRate: 3.375),
            Outcome(id: "o2", label: "Hold", deltaBps: 0, probability: 0.33, postMeetingRate: 3.625),
            Outcome(id: "o3", label: "Hike 25bps", deltaBps: 25, probability: 0.05, postMeetingRate: 3.875),
        ],
        snapshotAt: "2026-06-12T12:00:00Z"
    )

    return ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            ProbabilityTableView(snapshot: fixture)
            MovementChip(deltaPp: 4.2, windowDays: 7)
            MovementChip(deltaPp: -3.1, windowDays: 7)
            MovementChip(deltaPp: 0, windowDays: 7)
            MovementChip(deltaPp: nil)
        }
        .padding(24)
    }
    .background(RR.cream)
    .environment(Router())
    .environment(AppDataStore())
}
