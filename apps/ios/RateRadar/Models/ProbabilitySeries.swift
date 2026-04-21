import Foundation

struct ProbabilityPoint: Codable, Hashable {
    let snapshotAt: String        // ISO timestamp
    let probability: Double

    enum CodingKeys: String, CodingKey {
        case snapshotAt = "snapshot_at"
        case probability
    }

    var date: Date? {
        ISO8601DateFormatter().date(from: snapshotAt)
    }
}

struct ProbabilitySeries: Codable, Hashable, Identifiable {
    let outcomeId: String
    let label: String
    let deltaBps: Int
    let series: [ProbabilityPoint]

    var id: String { outcomeId }

    enum CodingKeys: String, CodingKey {
        case outcomeId = "outcome_id"
        case label
        case deltaBps = "delta_bps"
        case series
    }
}

struct ProbabilitySeriesResponse: Codable {
    let data: [ProbabilitySeries]
    let windowDays: Int

    enum CodingKeys: String, CodingKey {
        case data
        case windowDays = "window_days"
    }
}
