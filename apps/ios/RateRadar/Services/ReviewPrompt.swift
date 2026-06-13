import StoreKit
import SwiftUI

/// Pure decision for when to surface the system "rate this app" prompt. StoreKit
/// itself rate-limits the actual prompt (at most a few times per year); this gate
/// only picks a *positive* moment — the user has opened the app on at least two
/// sessions and has looked at an upcoming meeting — and asks at most once per
/// app version so we never nag.
enum ReviewGate {
    static func shouldRequest(
        launchCount: Int,
        hasViewedMeeting: Bool,
        lastPromptedVersion: String?,
        currentVersion: String
    ) -> Bool {
        guard launchCount >= 2, hasViewedMeeting else { return false }
        return lastPromptedVersion != currentVersion
    }
}

/// UserDefaults-backed driver around `ReviewGate`. No backend, no account.
@MainActor
enum ReviewPrompt {
    private static let launchCountKey = "rr.review.launchCount.v1"
    private static let viewedMeetingKey = "rr.review.viewedMeeting.v1"
    private static let lastPromptedVersionKey = "rr.review.lastPromptedVersion.v1"

    static var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    /// Call once per cold launch.
    static func recordLaunch() {
        let d = UserDefaults.standard
        d.set(d.integer(forKey: launchCountKey) + 1, forKey: launchCountKey)
    }

    /// Call when the user opens a meeting detail (a positive engagement signal).
    static func recordMeetingViewed() {
        UserDefaults.standard.set(true, forKey: viewedMeetingKey)
    }

    /// Ask for a review if the gate passes, then remember we asked for this
    /// version so the prompt fires at most once per release.
    static func maybeRequest(_ requestReview: RequestReviewAction) {
        let d = UserDefaults.standard
        guard ReviewGate.shouldRequest(
            launchCount: d.integer(forKey: launchCountKey),
            hasViewedMeeting: d.bool(forKey: viewedMeetingKey),
            lastPromptedVersion: d.string(forKey: lastPromptedVersionKey),
            currentVersion: currentVersion
        ) else { return }
        d.set(currentVersion, forKey: lastPromptedVersionKey)
        requestReview()
    }
}
