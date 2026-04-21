import Foundation

enum BankCode: String, Codable, Hashable, CaseIterable {
    case fed = "FED"
    case ecb = "ECB"

    var displayName: String {
        switch self {
        case .fed: return "Federal Reserve"
        case .ecb: return "European Central Bank"
        }
    }

    var shortName: String {
        switch self {
        case .fed: return "Fed"
        case .ecb: return "ECB"
        }
    }
}

enum MeetingStatus: String, Codable {
    case scheduled
    case inProgress = "in_progress"
    case completed
    case cancelled
}

struct Meeting: Codable, Hashable, Identifiable {
    let id: String
    let bankCode: BankCode
    let meetingDate: String       // ISO date YYYY-MM-DD
    let status: MeetingStatus

    enum CodingKeys: String, CodingKey {
        case id
        case bankCode = "bank_code"
        case meetingDate = "meeting_date"
        case status
    }

    var date: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.date(from: meetingDate)
    }
}

struct Outcome: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let deltaBps: Int
    let probability: Double
    let postMeetingRate: Double

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case deltaBps = "delta_bps"
        case probability
        case postMeetingRate = "post_meeting_rate"
    }
}

struct MeetingProbabilities: Codable, Hashable, Identifiable {
    let meeting: Meeting
    let outcomes: [Outcome]
    let snapshotAt: String

    var id: String { meeting.id }

    enum CodingKeys: String, CodingKey {
        case meeting
        case outcomes
        case snapshotAt = "snapshot_at"
    }

    var topOutcome: Outcome? {
        outcomes.max(by: { $0.probability < $1.probability })
    }
}

struct MeetingProbabilitiesResponse: Codable {
    let data: [MeetingProbabilities]
    let bank: BankCode?
}
