import Foundation

/// Codable mirror of GET /api/status (subset the app needs for the
/// methodology badge: version + snapshot freshness).
struct APIStatus: Codable {
    struct SnapshotMeta: Codable {
        let at: String
        let version: String?
    }

    struct Snapshots: Codable {
        let fed: SnapshotMeta?
        let ecb: SnapshotMeta?
    }

    let ok: Bool
    let dataSource: String?
    let snapshots: Snapshots?
    let latestSnapshotAt: String?

    enum CodingKeys: String, CodingKey {
        case ok
        case dataSource = "data_source"
        case snapshots
        case latestSnapshotAt = "latest_snapshot_at"
    }
}
