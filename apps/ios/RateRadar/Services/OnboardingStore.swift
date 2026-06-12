import Foundation

/// Mirrors apps/ios-expo/src/lib/onboardingStore.ts — same key, same "1" sentinel.
enum OnboardingStore {
    private static let key = "rr.onboarding.completed.v1"

    static var hasCompleted: Bool {
        UserDefaults.standard.string(forKey: key) == "1"
    }

    static func markCompleted() {
        UserDefaults.standard.set("1", forKey: key)
    }
}
