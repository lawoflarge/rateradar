import Foundation
import BackgroundTasks
import UserNotifications
import Observation

/// Carries a tapped notification's target meeting into the in-app Router.
/// RootView observes `pendingMeetingId` and navigates, then clears it.
@MainActor
@Observable
final class DeepLinkCenter {
    static let shared = DeepLinkCenter()
    var pendingMeetingId: String?
    private init() {}
}

/// Impure scheduling layer for the two alert kinds (pure rules live in
/// AlertEngine):
///  - meeting reminders: local UNCalendarNotificationTriggers the evening before
///    and the morning of each upcoming Fed/ECB decision, refreshed on every app
///    load so the carried odds stay current.
///  - rate-shift alerts: a best-effort BGAppRefresh compares the latest snapshot
///    to the last one the user saw and posts a local notification on a sharp move.
///    No backend, no APNs — fully on-device, honoring the after-session cadence.
enum AlertScheduler {

    static let backgroundTaskId = "com.lawoflarge.rateradar.refresh"
    private static let snapshotsKey = "rr.alerts.snapshots.v1"
    private static let reminderPrefix = "reminder."
    private static let shiftPrefix = "shift."

    // MARK: - Permission

    /// Requests notification authorization (local only). Returns the granted flag.
    @discardableResult
    static func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    private static func isAuthorized() async -> Bool {
        switch await authorizationStatus() {
        case .authorized, .provisional, .ephemeral: return true
        default: return false
        }
    }

    // MARK: - Meeting reminders

    /// Cancels existing meeting reminders and reschedules them from the current
    /// upcoming meetings. Safe to call on every foreground load.
    @MainActor
    static func rescheduleMeetingReminders(meetings: [MeetingProbabilities]) async {
        let center = UNUserNotificationCenter.current()
        let stale = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(reminderPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: stale)

        guard AlertPreferences.shared.meetingRemindersEnabled, await isAuthorized() else { return }

        let now = Date()
        for m in meetings where isUpcoming(m) {
            guard let top = m.topOutcome else { continue }
            let bank = m.meeting.bankCode.shortName
            let day = m.meeting.meetingDate

            for (kind, minusDays, hour) in [
                (AlertEngine.ReminderKind.dayBefore, 1, 18),
                (AlertEngine.ReminderKind.meetingDay, 0, 8),
            ] {
                guard let dc = components(forISODay: day, minusDays: minusDays, hour: hour),
                      let fireDate = Calendar.current.date(from: dc), fireDate > now
                else { continue }
                let copy = AlertEngine.reminderContent(
                    bankShort: bank, kind: kind,
                    topLabel: top.label, topProbability: top.probability
                )
                schedule(
                    id: "\(reminderPrefix)\(m.id).\(minusDays == 1 ? "eve" : "day")",
                    title: copy.title, body: copy.body, meetingId: m.id,
                    trigger: UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
                )
            }
        }
    }

    // MARK: - Snapshot baseline (foreground)

    /// Records what the user just saw so background shift checks only fire on
    /// moves that happen while the app is closed. No notification posted.
    @MainActor
    static func recordSnapshots(meetings: [MeetingProbabilities]) {
        var snaps = loadSnapshots()
        for m in meetings where isUpcoming(m) {
            guard let top = m.topOutcome else { continue }
            snaps[m.id] = .init(meetingId: m.id, topLabel: top.label, topProbability: top.probability)
        }
        saveSnapshots(snaps)
    }

    // MARK: - Background refresh (rate-shift alerts)

    static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundTaskId, using: nil
        ) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            handleBackgroundRefresh(refresh)
        }
    }

    static func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handleBackgroundRefresh(_ task: BGAppRefreshTask) {
        scheduleBackgroundRefresh() // chain the next opportunity
        let work = Task {
            await runShiftCheck()
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = { work.cancel() }
    }

    /// Fetches fresh probabilities, compares each upcoming meeting's leading
    /// outcome to the last seen snapshot, and posts a local alert on a sharp move.
    static func runShiftCheck() async {
        let prefs = await MainActor.run {
            (enabled: AlertPreferences.shared.rateShiftEnabled, threshold: AlertPreferences.shared.thresholdPP)
        }
        guard prefs.enabled, await isAuthorized() else { return }

        async let fed = try? APIClient.shared.getProbabilities(bank: .fed)
        async let ecb = try? APIClient.shared.getProbabilities(bank: .ecb)
        let meetings = ((await fed) ?? []) + ((await ecb) ?? [])
        guard !meetings.isEmpty else { return }

        var snaps = await MainActor.run { loadSnapshots() }
        for m in meetings where isUpcoming(m) {
            guard let top = m.topOutcome else { continue }
            if let alert = AlertEngine.detectShift(
                bankShort: m.meeting.bankCode.shortName,
                previous: snaps[m.id],
                currentTopLabel: top.label,
                currentTopProbability: top.probability,
                meetingId: m.id,
                thresholdPP: prefs.threshold
            ) {
                schedule(id: "\(shiftPrefix)\(m.id)", title: alert.title, body: alert.body,
                         meetingId: m.id, trigger: nil)
            }
            snaps[m.id] = .init(meetingId: m.id, topLabel: top.label, topProbability: top.probability)
        }
        await MainActor.run { saveSnapshots(snaps) }
    }

    // MARK: - Helpers

    private static func isUpcoming(_ m: MeetingProbabilities) -> Bool {
        guard m.meeting.status == .scheduled, let date = m.meeting.date else { return false }
        // Keep meetings through the end of their decision day.
        return date.addingTimeInterval(24 * 3600) > Date()
    }

    /// DateComponents (interpreted in the user's local calendar) for the meeting
    /// calendar day shifted back `minusDays`, at `hour:00`.
    private static func components(forISODay day: String, minusDays: Int, hour: Int) -> DateComponents? {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let f = DateFormatter()
        f.calendar = utc
        f.timeZone = utc.timeZone
        f.dateFormat = "yyyy-MM-dd"
        guard let base = f.date(from: day),
              let shifted = utc.date(byAdding: .day, value: -minusDays, to: base) else { return nil }
        let ymd = utc.dateComponents([.year, .month, .day], from: shifted)
        var dc = DateComponents()
        dc.year = ymd.year
        dc.month = ymd.month
        dc.day = ymd.day
        dc.hour = hour
        dc.minute = 0
        return dc
    }

    private static func schedule(
        id: String, title: String, body: String, meetingId: String,
        trigger: UNNotificationTrigger?
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["meetingId": meetingId]
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Snapshot persistence

    private static func loadSnapshots() -> [String: AlertEngine.OutcomeSnapshot] {
        guard let data = UserDefaults.standard.data(forKey: snapshotsKey),
              let decoded = try? JSONDecoder().decode([String: AlertEngine.OutcomeSnapshot].self, from: data)
        else { return [:] }
        return decoded
    }

    private static func saveSnapshots(_ snaps: [String: AlertEngine.OutcomeSnapshot]) {
        if let data = try? JSONEncoder().encode(snaps) {
            UserDefaults.standard.set(data, forKey: snapshotsKey)
        }
    }
}
