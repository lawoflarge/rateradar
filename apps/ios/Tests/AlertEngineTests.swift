import XCTest
@testable import RateRadar

final class AlertEngineTests: XCTestCase {

    private func snap(_ label: String, _ p: Double) -> AlertEngine.OutcomeSnapshot {
        .init(meetingId: "m1", topLabel: label, topProbability: p)
    }

    // MARK: pct / signedPP

    func testPctRoundsAndClamps() {
        XCTAssertEqual(AlertEngine.pct(0.0), 0)
        XCTAssertEqual(AlertEngine.pct(0.726), 73)
        XCTAssertEqual(AlertEngine.pct(1.0), 100)
        XCTAssertEqual(AlertEngine.pct(1.4), 100)   // clamped
        XCTAssertEqual(AlertEngine.pct(-0.2), 0)    // clamped
    }

    func testSignedPPHasNoDashAndKeepsSign() {
        XCTAssertEqual(AlertEngine.signedPP(12), "+12")
        XCTAssertEqual(AlertEngine.signedPP(-9.4), "-9")
        XCTAssertEqual(AlertEngine.signedPP(0), "+0")
    }

    // MARK: detectShift

    func testNoBaselineNeverAlerts() {
        XCTAssertNil(AlertEngine.detectShift(
            bankShort: "Fed", previous: nil,
            currentTopLabel: "Cut 25 bps", currentTopProbability: 0.6, meetingId: "m1"
        ))
    }

    func testSmallMoveBelowThresholdDoesNotAlert() {
        let alert = AlertEngine.detectShift(
            bankShort: "Fed", previous: snap("Hold", 0.60),
            currentTopLabel: "Hold", currentTopProbability: 0.66, meetingId: "m1"
        )
        XCTAssertNil(alert) // +6pp < 8pp default and no flip
    }

    func testLargeMoveAlerts() {
        let alert = AlertEngine.detectShift(
            bankShort: "Fed", previous: snap("Hold", 0.60),
            currentTopLabel: "Hold", currentTopProbability: 0.74, meetingId: "m1"
        )
        XCTAssertNotNil(alert)
        XCTAssertTrue(alert!.body.contains("74%"))
        XCTAssertTrue(alert!.body.contains("+14"))
        XCTAssertFalse(alert!.title.contains("flipped"))
    }

    func testFlipAlwaysAlertsEvenIfSmallMove() {
        let alert = AlertEngine.detectShift(
            bankShort: "ECB", previous: snap("Hold", 0.50),
            currentTopLabel: "Cut 25 bps", currentTopProbability: 0.51, meetingId: "m1"
        )
        XCTAssertNotNil(alert)
        XCTAssertTrue(alert!.title.contains("flipped"))
        XCTAssertTrue(alert!.body.contains("Cut 25 bps"))
        XCTAssertTrue(alert!.body.contains("51%"))
    }

    func testThresholdIsConfigurable() {
        XCTAssertNil(AlertEngine.detectShift(
            bankShort: "Fed", previous: snap("Hold", 0.60),
            currentTopLabel: "Hold", currentTopProbability: 0.69,
            meetingId: "m1", thresholdPP: 12
        )) // +9pp < custom 12pp
        XCTAssertNotNil(AlertEngine.detectShift(
            bankShort: "Fed", previous: snap("Hold", 0.60),
            currentTopLabel: "Hold", currentTopProbability: 0.69,
            meetingId: "m1", thresholdPP: 8
        )) // +9pp >= 8pp
    }

    func testCopyHasNoDashCharacters() {
        let alert = AlertEngine.detectShift(
            bankShort: "Fed", previous: snap("Hold", 0.40),
            currentTopLabel: "Cut 25 bps", currentTopProbability: 0.62, meetingId: "m1"
        )!
        for s in [alert.title, alert.body] {
            XCTAssertFalse(s.contains("\u{2014}"), "em dash in copy")
            XCTAssertFalse(s.contains("\u{2013}"), "en dash in copy")
            XCTAssertFalse(s.contains(" - "), "spaced hyphen dash in copy")
        }
    }

    // MARK: reminderContent

    func testDayBeforeReminderCopy() {
        let c = AlertEngine.reminderContent(
            bankShort: "Fed", kind: .dayBefore, topLabel: "Hold", topProbability: 0.72
        )
        XCTAssertEqual(c.title, "Fed decides tomorrow")
        XCTAssertTrue(c.body.contains("72%"))
        XCTAssertTrue(c.body.contains("hold"))
    }

    func testMeetingDayReminderCopy() {
        let c = AlertEngine.reminderContent(
            bankShort: "ECB", kind: .meetingDay, topLabel: "Cut 25 bps", topProbability: 0.55
        )
        XCTAssertEqual(c.title, "ECB decides today")
        XCTAssertTrue(c.body.contains("55%"))
    }
}
