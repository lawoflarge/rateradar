import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.timeoutIntervalForResource = 30
        session = URLSession(configuration: cfg)
        decoder = JSONDecoder()
    }

    func getProbabilities(bank: BankCode) async throws -> [MeetingProbabilities] {
        let path = "/api/\(bank.rawValue.lowercased())/probabilities"
        let resp: MeetingProbabilitiesResponse = try await get(path)
        return resp.data
    }

    func getHistory(
        meetingId: String,
        windowDays: Int = 60
    ) async throws -> [ProbabilitySeries] {
        let path = "/api/meetings/\(meetingId)/history?window=\(windowDays)d"
        let resp: ProbabilitySeriesResponse = try await get(path)
        return resp.data
    }

    /// GET /api/status — used for the methodology badge (version + freshness).
    func getStatus() async throws -> APIStatus {
        try await get("/api/status")
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = Config.apiURL(path)
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus(
                code: (response as? HTTPURLResponse)?.statusCode ?? -1
            )
        }
        return try decoder.decode(T.self, from: data)
    }
}

enum APIError: LocalizedError {
    case badStatus(code: Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(let code): return "Network error (\(code))"
        }
    }
}
