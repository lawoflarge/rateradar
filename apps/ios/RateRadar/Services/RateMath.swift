import Foundation

/// Shared derived-number math + date formatting, ported 1:1 from
/// apps/web/src/lib/{policy-rates,movement,scenario}.ts and the
/// MostLikelyPath / ImpliedRateCurve components.
enum RateMath {
    // MARK: - Policy rates (lib/policy-rates.ts)

    static let currentPolicyRates: [BankCode: Double] = [.fed: 3.625, .ecb: 2.0]
    static let currentPolicyRateLabels: [BankCode: String] = [
        .fed: "Fed Funds target range 3.50–3.75%",
        .ecb: "ECB Deposit Facility Rate 2.00%",
    ]

    // MARK: - Expected change / cumulative path (MostLikelyPath.tsx)

    /// Probability-weighted expected change in bps for one meeting: Σ p·Δ.
    static func expectedDeltaBps(_ s: MeetingProbabilities) -> Double {
        s.outcomes.reduce(0) { $0 + $1.probability * Double($1.deltaBps) }
    }

    struct PathEntry {
        let snapshot: MeetingProbabilities
        let expectedDelta: Double
        let cumulative: Double
    }

    /// Running cumulative expected bps across upcoming meetings, in order.
    static func pathEntries(_ snapshots: [MeetingProbabilities], maxMeetings: Int = 8) -> [PathEntry] {
        var acc: [PathEntry] = []
        for s in snapshots.prefix(maxMeetings) {
            let expected = expectedDeltaBps(s)
            let prev = acc.last?.cumulative ?? 0
            acc.append(PathEntry(snapshot: s, expectedDelta: expected, cumulative: prev + expected))
        }
        return acc
    }

    // MARK: - Implied rate curve (ImpliedRateCurve.tsx)

    struct CurvePoint: Identifiable {
        let id = UUID()
        let label: String
        let fullLabel: String
        let rate: Double
    }

    /// Expected policy rate at each meeting, chained from the current rate
    /// ("Now" anchor + one point per meeting).
    static func curvePoints(
        _ snapshots: [MeetingProbabilities],
        startingRate: Double,
        anchorLabel: String = "Now"
    ) -> [CurvePoint] {
        var points = [CurvePoint(label: anchorLabel, fullLabel: anchorLabel, rate: startingRate)]
        for s in snapshots {
            let prev = points[points.count - 1].rate
            let next = prev + expectedDeltaBps(s) / 100 // bps -> percent
            points.append(CurvePoint(
                label: shortDate(s.meeting.meetingDate),
                fullLabel: weekdayShortDate(s.meeting.meetingDate),
                rate: next
            ))
        }
        return points
    }

    // MARK: - Conditional scenarios (lib/scenario.ts)

    struct ConditionalScenario {
        let startingRate: Double
        let after: [MeetingProbabilities]
        let anchorLabel: String
    }

    static func buildConditional(
        snapshots: [MeetingProbabilities],
        meetingId: String,
        outcomeId: String
    ) -> ConditionalScenario? {
        guard let idx = snapshots.firstIndex(where: { $0.meeting.id == meetingId }),
              let outcome = snapshots[idx].outcomes.first(where: { $0.id == outcomeId })
        else { return nil }
        let after = Array(snapshots.dropFirst(idx + 1))
        guard !after.isEmpty else { return nil }
        return ConditionalScenario(
            startingRate: outcome.postMeetingRate,
            after: after,
            anchorLabel: "\(shortDate(snapshots[idx].meeting.meetingDate)): \(outcome.label)"
        )
    }

    // MARK: - Movement over a recent window (lib/movement.ts)

    struct OutcomeMovement {
        let deltaPp: Double
        let windowDays: Int
        let baselineProbability: Double
    }

    struct Movements {
        let windowDays: Int
        let byLabel: [String: OutcomeMovement]
    }

    private static func pickBaseline(
        _ series: [ProbabilityPoint], windowDays: Int
    ) -> (probability: Double, actualWindowDays: Int)? {
        guard !series.isEmpty else { return nil }
        if series.count == 1 { return (series[0].probability, 0) }

        let sorted = series.sorted { $0.snapshotAt < $1.snapshotAt }
        guard let latest = sorted.last?.date else { return nil }
        let cutoff = latest.addingTimeInterval(-Double(windowDays) * 86400)

        let onOrBefore = sorted.filter { ($0.date ?? .distantFuture) <= cutoff }
        let baseline = onOrBefore.last ?? sorted[0]
        let actualDays = Int(((latest.timeIntervalSince(baseline.date ?? latest)) / 86400).rounded())
        return (baseline.probability, actualDays)
    }

    static func computeMovements(
        history: [ProbabilitySeries]?, windowDays: Int = 7
    ) -> Movements? {
        guard let history, !history.isEmpty else { return nil }
        var byLabel: [String: OutcomeMovement] = [:]
        var maxActualWindow = 0
        for s in history where !s.series.isEmpty {
            let sorted = s.series.sorted { $0.snapshotAt < $1.snapshotAt }
            guard let latest = sorted.last,
                  let baseline = pickBaseline(s.series, windowDays: windowDays) else { continue }
            byLabel[s.label] = OutcomeMovement(
                deltaPp: (latest.probability - baseline.probability) * 100,
                windowDays: baseline.actualWindowDays,
                baselineProbability: baseline.probability
            )
            maxActualWindow = max(maxActualWindow, baseline.actualWindowDays)
        }
        guard !byLabel.isEmpty else { return nil }
        return Movements(windowDays: maxActualWindow != 0 ? maxActualWindow : windowDays, byLabel: byLabel)
    }

    /// JS parity for 0-decimal rounding: Math.round/toFixed(0) round half AWAY
    /// from zero (printf "%.0f" rounds half-to-even) and keep "-0" for small
    /// negatives (e.g. cumulative -0.4 bps renders "-0" like toFixed).
    static func pct0(_ value: Double) -> String {
        let r = value.rounded(.toNearestOrAwayFromZero)
        if r == 0 && value < 0 { return "-0" }
        return String(format: "%.0f", r)
    }

    enum DeltaSign { case up, down, flat }

    /// formatDelta from lib/movement.ts: "▲ +4.2pp" / "▼ −3.1pp" / "· flat" semantics.
    static func formatDelta(_ deltaPp: Double) -> (sign: DeltaSign, label: String) {
        let rounded = (deltaPp * 10).rounded() / 10
        if rounded == 0 { return (.flat, "0.0pp") }
        if rounded > 0 { return (.up, "+" + String(format: "%.1f", rounded) + "pp") }
        return (.down, String(format: "%.1f", rounded) + "pp")
    }

    // MARK: - Dates (web uses en-US toLocaleDateString everywhere)

    private static let enUS = Locale(identifier: "en_US")

    private static func formatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = enUS
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = format
        return f
    }

    private static let shortF = formatter("MMM d")
    private static let shortYearF = formatter("MMM d, yyyy")
    private static let weekdayShortF = formatter("EEE, MMM d")
    private static let longF = formatter("EEEE, MMMM d, yyyy")
    private static let mediumF = formatter("MMMM d, yyyy")
    private static let isoDayF = formatter("yyyy-MM-dd")

    static func parseISODay(_ iso: String) -> Date? {
        isoDayF.date(from: iso)
    }

    /// "Jun 17"
    static func shortDate(_ isoDay: String) -> String {
        guard let d = parseISODay(isoDay) else { return isoDay }
        return shortF.string(from: d)
    }

    /// "Jun 17, 2026"
    static func shortDateYear(_ isoDay: String) -> String {
        guard let d = parseISODay(isoDay) else { return isoDay }
        return shortYearF.string(from: d)
    }

    /// "Wed, Jun 17"
    static func weekdayShortDate(_ isoDay: String) -> String {
        guard let d = parseISODay(isoDay) else { return isoDay }
        return weekdayShortF.string(from: d)
    }

    /// "Wednesday, June 17, 2026"
    static func longDate(_ isoDay: String) -> String {
        guard let d = parseISODay(isoDay) else { return isoDay }
        return longF.string(from: d)
    }

    /// "June 17, 2026"
    static func mediumDate(_ isoDay: String) -> String {
        guard let d = parseISODay(isoDay) else { return isoDay }
        return mediumF.string(from: d)
    }

}
