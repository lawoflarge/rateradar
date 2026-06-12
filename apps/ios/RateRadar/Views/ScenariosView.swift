import SwiftUI

/// Port of apps/web/src/app/scenarios/page.tsx — conditional what-if rate
/// paths. The builder below ports components/ScenarioBuilder.tsx 1:1.
struct ScenariosView: View {
    @Environment(AppDataStore.self) private var store

    /// Preview-only fixture overrides; the live app reads the environment store.
    var fixtureFed: [MeetingProbabilities]? = nil
    var fixtureEcb: [MeetingProbabilities]? = nil

    private var fed: [MeetingProbabilities] { fixtureFed ?? store.fed }
    private var ecb: [MeetingProbabilities] { fixtureEcb ?? store.ecb }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("Scenarios")
                Text("Conditional rate paths")
                    .font(.rrSans(24, weight: .semibold))
                    .tracking(-0.5)
                    .foregroundStyle(RR.ink)
                    .padding(.top, 8)
                Text("Pick a meeting and an outcome — for example “Fed cuts 25bp in March” — and see how the market-implied path for the following meetings re-anchors on that assumption.")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 8)
                RRRule()
                ScenarioBuilderView(fed: fed, ecb: ecb)
                    .padding(.top, 24)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .background(RR.cream)
    }
}

// MARK: - ScenarioBuilder (components/ScenarioBuilder.tsx)

private struct ScenarioBuilderView: View {
    let fed: [MeetingProbabilities]
    let ecb: [MeetingProbabilities]

    @State private var bank: BankCode = .fed
    @State private var meetingId: String = ""
    @State private var outcomeId: String = ""

    private var snapshots: [MeetingProbabilities] { bank == .fed ? fed : ecb }
    private var ecbAvailable: Bool { !ecb.isEmpty }

    // Resolve the active selection defensively — fall back to the first
    // meeting/outcome of the current bank if the stored id is stale (e.g. just
    // after switching banks).
    private var activeMeeting: MeetingProbabilities? {
        snapshots.first { $0.meeting.id == meetingId } ?? snapshots.first
    }

    private var activeOutcome: Outcome? {
        activeMeeting?.outcomes.first { $0.id == outcomeId } ?? activeMeeting?.outcomes.first
    }

    private var conditional: RateMath.ConditionalScenario? {
        guard let meeting = activeMeeting, let outcome = activeOutcome else { return nil }
        return RateMath.buildConditional(
            snapshots: snapshots,
            meetingId: meeting.meeting.id,
            outcomeId: outcome.id
        )
    }

    private var bankLabel: String {
        bank == .fed ? "Federal Reserve" : "European Central Bank"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            bankToggle
            if snapshots.isEmpty {
                Text("No meetings available for this bank yet.")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
            } else {
                meetingSelector
                outcomeChips
                disclaimer
                baselineCurve
                conditionalCurve
            }
        }
    }

    // MARK: Bank toggle

    private var bankToggle: some View {
        HStack(spacing: 8) {
            ForEach([BankCode.fed, .ecb], id: \.self) { b in
                let disabled = b == .ecb && !ecbAvailable
                let active = b == bank
                Button {
                    selectBank(b)
                } label: {
                    Text(b == .fed ? "Fed" : "ECB")
                        .font(.rrMono(12))
                        .textCase(.uppercase)
                        .tracking(0.6)
                        .foregroundStyle(active ? RR.cut : RR.inkMute)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .overlay(
                            Rectangle()
                                .strokeBorder(
                                    active ? RR.cut : RR.ink.opacity(0.15),
                                    lineWidth: 1
                                )
                        )
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .opacity(disabled ? 0.4 : 1)
            }
        }
    }

    // MARK: Meeting selector

    private var meetingSelector: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Condition on meeting")
                .font(.rrMono(11))
                .textCase(.uppercase)
                .tracking(0.55)
                .foregroundStyle(RR.inkMute)
            Picker("Condition on meeting", selection: meetingSelection) {
                ForEach(snapshots) { s in
                    Text(Self.formatMeeting(s.meeting.meetingDate))
                        .tag(s.meeting.id)
                }
            }
            .pickerStyle(.menu)
            .tint(RR.ink)
            .font(.rrSans(14))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RR.cream)
            .overlay(Rectangle().strokeBorder(RR.ink.opacity(0.15), lineWidth: 1))
        }
    }

    private var meetingSelection: Binding<String> {
        Binding(
            get: { activeMeeting?.meeting.id ?? "" },
            set: { selectMeeting($0) }
        )
    }

    // MARK: Outcome chips

    private var outcomeChips: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("…resolves to")
                .font(.rrMono(11))
                .textCase(.uppercase)
                .tracking(0.55)
                .foregroundStyle(RR.inkMute)
            WrappingHStack(spacing: 8, lineSpacing: 8) {
                ForEach(activeMeeting?.outcomes ?? []) { o in
                    let active = o.id == activeOutcome?.id
                    Button {
                        outcomeId = o.id
                    } label: {
                        Text("\(o.label) · \(RateMath.pct0(o.probability * 100))%")
                            .font(.rrMono(12))
                            .foregroundStyle(active ? RR.cut : RR.inkMute)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .overlay(
                                Rectangle()
                                    .strokeBorder(
                                        active ? RR.cut : RR.ink.opacity(0.15),
                                        lineWidth: 1
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Disclaimer

    private var disclaimer: some View {
        (
            Text("What-if scenario. Assumes the subsequent meetings' market-implied distributions are ")
            + Text("unchanged").font(.rrSans(12, weight: .semibold))
            + Text(" (independence) and re-anchors the path on the selected outcome. This is not a forecast.")
        )
        .font(.rrSans(12))
        .foregroundStyle(RR.inkMute)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RR.creamSoft)
        .overlay(alignment: .leading) {
            Rectangle().fill(RR.cut.opacity(0.4)).frame(width: 2)
        }
    }

    // MARK: Baseline curve

    private var baselineCurve: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Baseline (today's market path)")
                .font(.rrMono(11))
                .textCase(.uppercase)
                .tracking(0.55)
                .foregroundStyle(RR.inkMute)
            ImpliedRateCurveView(
                snapshots: snapshots,
                startingRate: RateMath.currentPolicyRates[bank] ?? 0,
                bankLabel: bankLabel
            )
        }
    }

    // MARK: Conditional curve

    private var conditionalCurve: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Conditional (\(conditional?.anchorLabel ?? "—"))")
                .font(.rrMono(11))
                .textCase(.uppercase)
                .tracking(0.55)
                .foregroundStyle(RR.cut)
            if let conditional {
                ImpliedRateCurveView(
                    snapshots: conditional.after,
                    startingRate: conditional.startingRate,
                    bankLabel: "\(bankLabel) — if \(conditional.anchorLabel)",
                    anchorLabel: conditional.anchorLabel
                )
            } else {
                Text("This is the last scheduled meeting — there is no subsequent path to project. Pick an earlier meeting.")
                    .font(.rrSans(14))
                    .foregroundStyle(RR.inkMute)
            }
        }
    }

    // MARK: Actions (ScenarioBuilder.tsx selectBank/selectMeeting)

    private func selectBank(_ next: BankCode) {
        if next == .ecb && !ecbAvailable { return }
        bank = next
        let list = next == .fed ? fed : ecb
        meetingId = list.first?.meeting.id ?? ""
        outcomeId = list.first?.outcomes.first?.id ?? ""
    }

    private func selectMeeting(_ id: String) {
        meetingId = id
        let m = snapshots.first { $0.meeting.id == id }
        outcomeId = m?.outcomes.first?.id ?? ""
    }

    // MARK: Dates (ScenarioBuilder.tsx formatMeeting — en-US "MMM d, yyyy")

    private static let meetingFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "MMM d, yyyy"
        return f
    }()

    private static func formatMeeting(_ iso: String) -> String {
        guard let d = RateMath.parseISODay(iso) else { return iso }
        return meetingFormatter.string(from: d)
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
        ScenariosView(fixtureFed: fed, fixtureEcb: ecb)
    }
    .environment(AppDataStore())
    .environment(Router())
}
