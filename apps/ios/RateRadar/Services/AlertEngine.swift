import Foundation

/// Pure logic for RateRadar alerts — meeting reminders and rate-shift alerts.
/// No I/O, no UNUserNotificationCenter: all scheduling and persistence lives in
/// NotificationsManager. Kept pure so the trigger rules are unit-tested, in the
/// same spirit as InterstitialPolicy.
///
/// Two alert kinds:
///  - Meeting reminder: a deterministic heads-up the evening before and the
///    morning of each upcoming Fed/ECB decision, carrying the current odds.
///  - Rate-shift alert: fired from a background refresh when the most-likely
///    outcome for a meeting flips, or its probability moves by at least
///    `thresholdPP` percentage points since the last seen snapshot. This is the
///    "heads-up when odds move sharply" the onboarding has always promised.
enum AlertEngine {

    // MARK: - Snapshot persisted between background refreshes

    /// The most-likely outcome last seen for one meeting. Compared against a
    /// fresh fetch to detect a sharp move.
    struct OutcomeSnapshot: Codable, Equatable {
        var meetingId: String
        var topLabel: String
        var topProbability: Double   // 0...1
    }

    /// Default trigger: the leading probability moves by at least this many
    /// percentage points, or the leading outcome itself changes.
    static let defaultThresholdPP: Double = 8

    struct ShiftAlert: Equatable {
        var meetingId: String
        var title: String
        var body: String
    }

    // MARK: - Formatting

    /// 0...1 probability to a whole percent (matches the glanceable copy style).
    static func pct(_ p: Double) -> Int {
        Int((max(0, min(1, p)) * 100).rounded())
    }

    /// "+12" / "-9" / "+0" — signed percentage-point delta, no dash characters.
    static func signedPP(_ deltaPP: Double) -> String {
        let r = Int(deltaPP.rounded())
        return r >= 0 ? "+\(r)" : "\(r)"
    }

    // MARK: - Rate-shift detection

    /// Returns an alert when the leading outcome flipped or moved past the
    /// threshold versus `previous`. Returns nil on the first run (no baseline)
    /// or when the move is within noise.
    static func detectShift(
        bankShort: String,
        previous: OutcomeSnapshot?,
        currentTopLabel: String,
        currentTopProbability: Double,
        meetingId: String,
        thresholdPP: Double = defaultThresholdPP
    ) -> ShiftAlert? {
        guard let prev = previous else { return nil }
        let flipped = prev.topLabel != currentTopLabel
        let deltaPP = (currentTopProbability - prev.topProbability) * 100
        guard flipped || abs(deltaPP) >= thresholdPP else { return nil }

        let nowPct = pct(currentTopProbability)
        if flipped {
            return ShiftAlert(
                meetingId: meetingId,
                title: "\(bankShort) odds flipped",
                body: "\(currentTopLabel) is now the most likely call at \(nowPct)%. Tap to see the shift."
            )
        }
        return ShiftAlert(
            meetingId: meetingId,
            title: "\(bankShort) odds moved sharply",
            body: "\(currentTopLabel) odds are \(nowPct)% (\(signedPP(deltaPP)) pts). Tap to see the shift."
        )
    }

    // MARK: - Meeting reminder copy

    enum ReminderKind { case dayBefore, meetingDay }

    /// Title + body for a meeting reminder carrying the current leading outcome.
    static func reminderContent(
        bankShort: String,
        kind: ReminderKind,
        topLabel: String,
        topProbability: Double
    ) -> (title: String, body: String) {
        let nowPct = pct(topProbability)
        switch kind {
        case .dayBefore:
            return (
                "\(bankShort) decides tomorrow",
                "Market is pricing \(topLabel.lowercased()) at \(nowPct)%. Tap for the full odds."
            )
        case .meetingDay:
            return (
                "\(bankShort) decides today",
                "Heading in: \(topLabel.lowercased()) at \(nowPct)%. Tap for the live odds."
            )
        }
    }
}
