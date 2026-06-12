import UIKit
import UserNotifications

/// Mirrors apps/ios-expo/src/lib/notifications.ts: permission + APNs registration
/// plumbing only. The device token is intentionally not sent anywhere (v1 parity —
/// groundwork for future rate-shift alerts).
enum NotificationsManager {
    @MainActor
    static func requestPushPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(
            options: [.alert, .badge, .sound, .providesAppNotificationSettings]
        )) ?? false
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // Foreground presentation mirrors the Expo setNotificationHandler:
    // banner + list + badge, no sound.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .badge])
    }
}
