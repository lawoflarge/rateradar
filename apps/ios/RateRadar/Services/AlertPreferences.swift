import Foundation
import Observation

/// User-controlled alert settings, persisted in UserDefaults. Read by the
/// Alerts settings screen and the AlertScheduler. Toggles express intent;
/// actual delivery still requires notification permission (gated separately).
@MainActor
@Observable
final class AlertPreferences {
    static let shared = AlertPreferences()

    private enum Key {
        static let meetingReminders = "rr.alerts.meetingReminders.enabled"
        static let rateShift = "rr.alerts.rateShift.enabled"
        static let threshold = "rr.alerts.threshold.pp"
    }

    /// Day-before and meeting-morning reminders for each upcoming decision.
    var meetingRemindersEnabled: Bool {
        didSet { UserDefaults.standard.set(meetingRemindersEnabled, forKey: Key.meetingReminders) }
    }

    /// Background heads-up when the leading odds move sharply between refreshes.
    var rateShiftEnabled: Bool {
        didSet { UserDefaults.standard.set(rateShiftEnabled, forKey: Key.rateShift) }
    }

    /// Percentage-point move that counts as "sharp" (5...25, default 8).
    var thresholdPP: Double {
        didSet { UserDefaults.standard.set(thresholdPP, forKey: Key.threshold) }
    }

    private init() {
        let d = UserDefaults.standard
        // Default ON: a user only reaches these toggles via the onboarding ask or
        // the Alerts screen, and both kinds are opt-in at the OS permission layer.
        meetingRemindersEnabled = d.object(forKey: Key.meetingReminders) as? Bool ?? true
        rateShiftEnabled = d.object(forKey: Key.rateShift) as? Bool ?? true
        let t = d.object(forKey: Key.threshold) as? Double ?? AlertEngine.defaultThresholdPP
        thresholdPP = min(25, max(5, t))
    }
}
