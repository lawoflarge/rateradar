import Foundation

/// Pure interstitial frequency policy — 1:1 port of
/// apps/ios-expo/src/lib/interstitialPolicy.ts (unit-tested there and here).
///
/// Show on every 3rd qualifying event, max 3 per session, at least 180s apart
/// (last-shown timestamp persisted across launches).
struct InterstitialPolicy {
    static let showEvery = 3
    static let sessionCap = 3
    static let minIntervalMs: Double = 180_000

    struct State {
        var count: Int = 0
        var adLoaded: Bool = false
        var shownThisSession: Int = 0
        /// Epoch milliseconds of the last shown interstitial (0 = never).
        var lastShownTs: Double = 0
    }

    static func shouldShow(_ s: State, nowMs: Double) -> Bool {
        s.adLoaded
            && s.count > 0
            && s.count % showEvery == 0
            && s.shownThisSession < sessionCap
            && nowMs - s.lastShownTs >= minIntervalMs
    }
}
