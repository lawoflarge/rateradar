import Foundation

enum Config {
    /// Production API host. Override at runtime via the `RATERADAR_API_HOST`
    /// environment variable (scheme → Edit scheme → Run → Arguments → Env Vars).
    static let apiHost: String = {
        if let env = ProcessInfo.processInfo.environment["RATERADAR_API_HOST"],
           !env.isEmpty {
            return env
        }
        return "https://rateradar-web.vercel.app"
    }()

    static func apiURL(_ path: String) -> URL {
        URL(string: "\(apiHost)\(path)")!
    }

    /// Screenshot mode. Set `RATERADAR_SCREENSHOTS=1` (e.g. via
    /// `SIMCTL_CHILD_RATERADAR_SCREENSHOTS=1 xcrun simctl launch`) to hide
    /// monetization chrome (the banner ad) so App Store screenshot captures
    /// stay clean. No effect on normal runs.
    static let screenshotMode: Bool =
        ProcessInfo.processInfo.environment["RATERADAR_SCREENSHOTS"] == "1"
}
