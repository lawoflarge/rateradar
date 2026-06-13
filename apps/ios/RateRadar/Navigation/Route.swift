import Foundation
import Observation

/// Mirror of the web app's routes as seen inside the current WebView.
enum Route: Hashable {
    case fed
    case ecb
    case meeting(String) // meeting id, e.g. "FED-2026-06-17"
    case compare
    case scenarios
    case methodology
    case glossary
    case glossaryTerm(String) // slug, e.g. "basis-points"
    case brokers
    case about
    case privacy
    case alerts

    /// Interstitial qualifying routes (web NativeNavBridge: /meeting/* + /compare).
    var isQualifyingEvent: Bool {
        switch self {
        case .meeting, .compare: return true
        default: return false
        }
    }
}

@MainActor
@Observable
final class Router {
    var path: [Route] = []

    func navigate(_ route: Route) {
        path.append(route)
    }

    func popToRoot() {
        path.removeAll()
    }
}
