import XCTest
@testable import RateRadar

/// Decoding tests for the three API payloads the app consumes.
/// Fixtures mirror the LIVE shapes returned by rateradar-web.vercel.app
/// (captured 2026-06-12 from /api/fed/probabilities,
/// /api/meetings/FED-2026-06-17/history?window=60d and /api/status),
/// trimmed to 2 meetings / 2 series.
final class APIDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    // MARK: - MeetingProbabilitiesResponse (/api/fed/probabilities)

    private let probabilitiesJSON = """
    {"data":[{"meeting":{"id":"FED-2026-06-17","bank_code":"FED","meeting_date":"2026-06-17","status":"scheduled"},"snapshot_at":"2026-06-11T23:44:08+00:00","outcomes":[{"id":"FED-2026-06-17--50","label":"-50bp","delta_bps":-50,"probability":0,"post_meeting_rate":3.125},{"id":"FED-2026-06-17--25","label":"-25bp","delta_bps":-25,"probability":0.0461284930889434,"post_meeting_rate":3.375},{"id":"FED-2026-06-17-0","label":"Hold","delta_bps":0,"probability":0.9538715069110566,"post_meeting_rate":3.625},{"id":"FED-2026-06-17-25","label":"+25bp","delta_bps":25,"probability":0,"post_meeting_rate":3.875},{"id":"FED-2026-06-17-50","label":"+50bp","delta_bps":50,"probability":0,"post_meeting_rate":4.125}]},{"meeting":{"id":"FED-2026-07-29","bank_code":"FED","meeting_date":"2026-07-29","status":"scheduled"},"snapshot_at":"2026-06-11T23:44:08+00:00","outcomes":[{"id":"FED-2026-07-29--50","label":"-50bp","delta_bps":-50,"probability":0,"post_meeting_rate":3.113467876727764},{"id":"FED-2026-07-29--25","label":"-25bp","delta_bps":-25,"probability":0,"post_meeting_rate":3.363467876727764},{"id":"FED-2026-07-29-0","label":"Hold","delta_bps":0,"probability":0.8738849346454316,"post_meeting_rate":3.613467876727764},{"id":"FED-2026-07-29-25","label":"+25bp","delta_bps":25,"probability":0.1261150653545684,"post_meeting_rate":3.863467876727764},{"id":"FED-2026-07-29-50","label":"+50bp","delta_bps":50,"probability":0,"post_meeting_rate":4.113467876727764}]}],"bank":"FED"}
    """

    func testDecodesMeetingProbabilitiesResponse() throws {
        let resp = try decoder.decode(
            MeetingProbabilitiesResponse.self,
            from: Data(probabilitiesJSON.utf8)
        )

        XCTAssertEqual(resp.bank, .fed)
        XCTAssertEqual(resp.data.count, 2)

        let first = try XCTUnwrap(resp.data.first)
        XCTAssertEqual(first.meeting.id, "FED-2026-06-17")
        XCTAssertEqual(first.meeting.bankCode, .fed)
        XCTAssertEqual(first.meeting.meetingDate, "2026-06-17")
        XCTAssertEqual(first.meeting.status, .scheduled)
        XCTAssertEqual(first.snapshotAt, "2026-06-11T23:44:08+00:00")
        XCTAssertEqual(first.id, "FED-2026-06-17") // Identifiable via meeting.id
        XCTAssertNotNil(first.meeting.date)

        XCTAssertEqual(first.outcomes.count, 5)
        let cut25 = first.outcomes[1]
        XCTAssertEqual(cut25.id, "FED-2026-06-17--25")
        XCTAssertEqual(cut25.label, "-25bp")
        XCTAssertEqual(cut25.deltaBps, -25)
        XCTAssertEqual(cut25.probability, 0.0461284930889434, accuracy: 1e-12)
        XCTAssertEqual(cut25.postMeetingRate, 3.375, accuracy: 1e-12)

        let top = try XCTUnwrap(first.topOutcome)
        XCTAssertEqual(top.label, "Hold")
        XCTAssertEqual(top.deltaBps, 0)
        XCTAssertEqual(top.probability, 0.9538715069110566, accuracy: 1e-12)

        let second = resp.data[1]
        XCTAssertEqual(second.meeting.id, "FED-2026-07-29")
        XCTAssertEqual(second.topOutcome?.label, "Hold")
        XCTAssertEqual(second.outcomes[3].probability, 0.1261150653545684, accuracy: 1e-12)
        XCTAssertEqual(second.outcomes[2].postMeetingRate, 3.613467876727764, accuracy: 1e-12)
    }

    func testDecodesMeetingProbabilitiesResponseWithoutBankKey() throws {
        let json = """
        {"data":[{"meeting":{"id":"ECB-2026-06-04","bank_code":"ECB","meeting_date":"2026-06-04","status":"completed"},"snapshot_at":"2026-06-11T23:44:12+00:00","outcomes":[{"id":"ECB-2026-06-04-0","label":"Hold","delta_bps":0,"probability":1,"post_meeting_rate":2.0}]}]}
        """
        let resp = try decoder.decode(
            MeetingProbabilitiesResponse.self,
            from: Data(json.utf8)
        )
        XCTAssertNil(resp.bank)
        XCTAssertEqual(resp.data.first?.meeting.bankCode, .ecb)
        XCTAssertEqual(resp.data.first?.meeting.status, .completed)
    }

    // MARK: - ProbabilitySeriesResponse (/api/meetings/{id}/history?window=60d)

    private let historyJSON = """
    {"data":[{"outcome_id":"FED-2026-06-17--50","label":"-50bp","delta_bps":-50,"series":[{"snapshot_at":"2026-05-14T09:56:38+00:00","probability":0},{"snapshot_at":"2026-06-11T20:20:43+00:00","probability":0},{"snapshot_at":"2026-06-11T23:44:08+00:00","probability":0}]},{"outcome_id":"FED-2026-06-17-0","label":"Hold","delta_bps":0,"series":[{"snapshot_at":"2026-05-14T09:56:38+00:00","probability":0.9112},{"snapshot_at":"2026-06-11T20:20:43+00:00","probability":0.9447},{"snapshot_at":"2026-06-11T23:44:08+00:00","probability":0.9538715069110566}]}],"window_days":60}
    """

    func testDecodesProbabilitySeriesResponse() throws {
        let resp = try decoder.decode(
            ProbabilitySeriesResponse.self,
            from: Data(historyJSON.utf8)
        )

        XCTAssertEqual(resp.windowDays, 60)
        XCTAssertEqual(resp.data.count, 2)

        let cut = try XCTUnwrap(resp.data.first)
        XCTAssertEqual(cut.outcomeId, "FED-2026-06-17--50")
        XCTAssertEqual(cut.id, "FED-2026-06-17--50") // Identifiable via outcomeId
        XCTAssertEqual(cut.label, "-50bp")
        XCTAssertEqual(cut.deltaBps, -50)
        XCTAssertEqual(cut.series.count, 3)
        XCTAssertEqual(cut.series[0].snapshotAt, "2026-05-14T09:56:38+00:00")
        XCTAssertEqual(cut.series[0].probability, 0, accuracy: 1e-12)

        let hold = resp.data[1]
        XCTAssertEqual(hold.label, "Hold")
        XCTAssertEqual(hold.series.last?.probability ?? 0, 0.9538715069110566, accuracy: 1e-12)

        // The +00:00 offset timestamps must parse to real Dates (movement math relies on it).
        let date = try XCTUnwrap(hold.series.last?.date)
        let earlier = try XCTUnwrap(hold.series.first?.date)
        XCTAssertGreaterThan(date, earlier)
    }

    // MARK: - APIStatus (/api/status)

    private let statusJSON = """
    {"ok":true,"supabase":"configured","data_source":"supabase","counts":{"meetings":null,"outcomes":null,"snapshots":null},"snapshots":{"fed":{"at":"2026-06-11T23:44:08+00:00","version":"1.2.0"},"ecb":{"at":"2026-06-11T23:44:12+00:00","version":"1.2.0"}},"latest_snapshot_at":null,"version":"0.1.0"}
    """

    func testDecodesAPIStatus() throws {
        let status = try decoder.decode(APIStatus.self, from: Data(statusJSON.utf8))

        XCTAssertTrue(status.ok)
        XCTAssertEqual(status.dataSource, "supabase")
        XCTAssertNil(status.latestSnapshotAt) // live API returns null here

        let fed = try XCTUnwrap(status.snapshots?.fed)
        XCTAssertEqual(fed.at, "2026-06-11T23:44:08+00:00")
        XCTAssertEqual(fed.version, "1.2.0")

        let ecb = try XCTUnwrap(status.snapshots?.ecb)
        XCTAssertEqual(ecb.at, "2026-06-11T23:44:12+00:00")
        XCTAssertEqual(ecb.version, "1.2.0")
    }

    func testDecodesAPIStatusWithMissingOptionalKeys() throws {
        let json = """
        {"ok":false}
        """
        let status = try decoder.decode(APIStatus.self, from: Data(json.utf8))
        XCTAssertFalse(status.ok)
        XCTAssertNil(status.dataSource)
        XCTAssertNil(status.snapshots)
        XCTAssertNil(status.latestSnapshotAt)
    }
}
