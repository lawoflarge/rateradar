import Foundation
import Observation

/// App-wide data store: upcoming-meeting probabilities for both banks plus a
/// per-meeting history cache. Views read this via @Environment.
@MainActor
@Observable
final class AppDataStore {
    private(set) var fed: [MeetingProbabilities] = []
    private(set) var ecb: [MeetingProbabilities] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var histories: [String: [ProbabilitySeries]] = [:]

    var hasLoaded: Bool { !fed.isEmpty || !ecb.isEmpty }

    func snapshots(for bank: BankCode) -> [MeetingProbabilities] {
        bank == .fed ? fed : ecb
    }

    /// Both banks' meetings, Fed first (matches web data ordering on /).
    var all: [MeetingProbabilities] { fed + ecb }

    func meeting(id: String) -> MeetingProbabilities? {
        all.first { $0.meeting.id == id }
    }

    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let fedData = APIClient.shared.getProbabilities(bank: .fed)
            async let ecbData = APIClient.shared.getProbabilities(bank: .ecb)
            let (f, e) = try await (fedData, ecbData)
            fed = f
            ecb = e
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// 60d history per meeting, cached for the session (web revalidates at 300s
    /// server-side; in-app navigation reuse matches the WebView's behavior).
    func history(meetingId: String, windowDays: Int = 60) async -> [ProbabilitySeries] {
        let key = "\(meetingId)#\(windowDays)"
        if let cached = histories[key] { return cached }
        let series = (try? await APIClient.shared.getHistory(
            meetingId: meetingId, windowDays: windowDays
        )) ?? []
        if !series.isEmpty { histories[key] = series }
        return series
    }
}
