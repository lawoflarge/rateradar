import XCTest
@testable import RateRadar

/// Port of apps/ios-expo/__tests__/interstitialPolicy.test.ts.
final class InterstitialPolicyTests: XCTestCase {
    private func state(
        count: Int = 0, adLoaded: Bool = true,
        shownThisSession: Int = 0, lastShownTs: Double = 0
    ) -> InterstitialPolicy.State {
        .init(count: count, adLoaded: adLoaded,
              shownThisSession: shownThisSession, lastShownTs: lastShownTs)
    }

    func testShowsOnEveryThirdQualifyingEvent() {
        let now: Double = 10_000_000
        XCTAssertFalse(InterstitialPolicy.shouldShow(state(count: 1), nowMs: now))
        XCTAssertFalse(InterstitialPolicy.shouldShow(state(count: 2), nowMs: now))
        XCTAssertTrue(InterstitialPolicy.shouldShow(state(count: 3), nowMs: now))
        XCTAssertFalse(InterstitialPolicy.shouldShow(state(count: 4), nowMs: now))
        XCTAssertTrue(InterstitialPolicy.shouldShow(state(count: 6), nowMs: now))
    }

    func testNeverShowsWithZeroCount() {
        XCTAssertFalse(InterstitialPolicy.shouldShow(state(count: 0), nowMs: 10_000_000))
    }

    func testRequiresLoadedAd() {
        XCTAssertFalse(InterstitialPolicy.shouldShow(
            state(count: 3, adLoaded: false), nowMs: 10_000_000
        ))
    }

    func testSessionCapOfThree() {
        let now: Double = 10_000_000
        XCTAssertTrue(InterstitialPolicy.shouldShow(
            state(count: 3, shownThisSession: 2), nowMs: now
        ))
        XCTAssertFalse(InterstitialPolicy.shouldShow(
            state(count: 3, shownThisSession: 3), nowMs: now
        ))
    }

    func testMinIntervalOf180Seconds() {
        let last: Double = 10_000_000
        XCTAssertFalse(InterstitialPolicy.shouldShow(
            state(count: 3, lastShownTs: last), nowMs: last + 179_999
        ))
        XCTAssertTrue(InterstitialPolicy.shouldShow(
            state(count: 3, lastShownTs: last), nowMs: last + 180_000
        ))
    }

    func testFirstRunHasNoIntervalFloor() {
        // lastShownTs 0 default — any modern timestamp clears the floor.
        XCTAssertTrue(InterstitialPolicy.shouldShow(state(count: 3), nowMs: 1_000_000))
    }
}
