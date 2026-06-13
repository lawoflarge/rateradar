import XCTest
@testable import RateRadar

final class ReviewGateTests: XCTestCase {

    func testBelowLaunchThresholdNeverAsks() {
        XCTAssertFalse(ReviewGate.shouldRequest(
            launchCount: 1, hasViewedMeeting: true,
            lastPromptedVersion: nil, currentVersion: "1.2.1"))
    }

    func testNoMeetingViewedNeverAsks() {
        XCTAssertFalse(ReviewGate.shouldRequest(
            launchCount: 5, hasViewedMeeting: false,
            lastPromptedVersion: nil, currentVersion: "1.2.1"))
    }

    func testEligibleFirstTimeAsks() {
        XCTAssertTrue(ReviewGate.shouldRequest(
            launchCount: 2, hasViewedMeeting: true,
            lastPromptedVersion: nil, currentVersion: "1.2.1"))
    }

    func testDoesNotAskTwiceForSameVersion() {
        XCTAssertFalse(ReviewGate.shouldRequest(
            launchCount: 9, hasViewedMeeting: true,
            lastPromptedVersion: "1.2.1", currentVersion: "1.2.1"))
    }

    func testAsksAgainAfterVersionBump() {
        XCTAssertTrue(ReviewGate.shouldRequest(
            launchCount: 9, hasViewedMeeting: true,
            lastPromptedVersion: "1.2.0", currentVersion: "1.2.1"))
    }
}
