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
}
