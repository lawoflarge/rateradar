import XCTest
@testable import RateRadar

/// Unit tests for RateMath — the 1:1 port of apps/web/src/lib/movement.ts,
/// lib/scenario.ts and the MostLikelyPath / ImpliedRateCurve math.
final class RateMathTests: XCTestCase {
    // MARK: - Fixtures

    private func outcome(
        _ label: String, deltaBps: Int, probability: Double, rate: Double = 0
    ) -> Outcome {
        Outcome(
            id: "o-\(label)", label: label, deltaBps: deltaBps,
            probability: probability, postMeetingRate: rate
        )
    }

    private func snap(
        _ id: String, date: String, _ outcomes: [Outcome]
    ) -> MeetingProbabilities {
        MeetingProbabilities(
            meeting: Meeting(id: id, bankCode: .fed, meetingDate: date, status: .scheduled),
            outcomes: outcomes,
            snapshotAt: "2026-06-11T23:44:08+00:00"
        )
    }

    /// ISO point on a June 2026 day at midnight UTC.
    private func point(juneDay: Int, p: Double) -> ProbabilityPoint {
        ProbabilityPoint(
            snapshotAt: String(format: "2026-06-%02dT00:00:00+00:00", juneDay),
            probability: p
        )
    }

    private func series(
        _ label: String, deltaBps: Int = 0, _ points: [ProbabilityPoint]
    ) -> ProbabilitySeries {
        ProbabilitySeries(
            outcomeId: "o-\(label)", label: label, deltaBps: deltaBps, series: points
        )
    }

    // MARK: - expectedDeltaBps (Σ p·Δ)

    func testExpectedDeltaBpsIsProbabilityWeightedSum() {
        let s = snap("FED-2026-06-17", date: "2026-06-17", [
            outcome("-25bp", deltaBps: -25, probability: 0.2),
            outcome("Hold", deltaBps: 0, probability: 0.7),
            outcome("+25bp", deltaBps: 25, probability: 0.1),
        ])
        // 0.2·(-25) + 0.7·0 + 0.1·25 = -2.5
        XCTAssertEqual(RateMath.expectedDeltaBps(s), -2.5, accuracy: 1e-12)
    }

    func testExpectedDeltaBpsEmptyOutcomesIsZero() {
        XCTAssertEqual(RateMath.expectedDeltaBps(snap("X", date: "2026-06-17", [])), 0)
    }

    // MARK: - pathEntries (cumulative chaining)

    func testPathEntriesChainCumulativeExpectedDeltas() {
        let a = snap("A", date: "2026-06-17", [
            outcome("-25bp", deltaBps: -25, probability: 0.2),
            outcome("Hold", deltaBps: 0, probability: 0.8),
        ]) // expected -5
        let b = snap("B", date: "2026-07-29", [
            outcome("+25bp", deltaBps: 25, probability: 0.4),
            outcome("Hold", deltaBps: 0, probability: 0.6),
        ]) // expected +10
        let entries = RateMath.pathEntries([a, b])

        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries[0].expectedDelta, -5, accuracy: 1e-12)
        XCTAssertEqual(entries[0].cumulative, -5, accuracy: 1e-12)
        XCTAssertEqual(entries[1].expectedDelta, 10, accuracy: 1e-12)
        XCTAssertEqual(entries[1].cumulative, 5, accuracy: 1e-12) // -5 + 10
        XCTAssertEqual(entries[0].snapshot.meeting.id, "A")
        XCTAssertEqual(entries[1].snapshot.meeting.id, "B")
    }

    func testPathEntriesRespectMaxMeetings() {
        let hold = [outcome("Hold", deltaBps: 0, probability: 1)]
        let snaps = [
            snap("A", date: "2026-06-17", hold),
            snap("B", date: "2026-07-29", hold),
            snap("C", date: "2026-09-16", hold),
        ]
        XCTAssertEqual(RateMath.pathEntries(snaps, maxMeetings: 2).count, 2)
        XCTAssertEqual(RateMath.pathEntries(snaps).count, 3)
    }

    // MARK: - curvePoints (anchor + chaining)

    func testCurvePointsAnchorAndChainFromStartingRate() {
        let a = snap("A", date: "2026-06-17", [
            outcome("-25bp", deltaBps: -25, probability: 1, rate: 3.375),
        ]) // expected -25 bps
        let b = snap("B", date: "2026-07-29", [
            outcome("Hold", deltaBps: 0, probability: 0.5),
            outcome("+50bp", deltaBps: 50, probability: 0.5),
        ]) // expected +25 bps
        let points = RateMath.curvePoints([a, b], startingRate: 3.625)

        XCTAssertEqual(points.count, 3) // "Now" anchor + one per meeting
        XCTAssertEqual(points[0].label, "Now")
        XCTAssertEqual(points[0].fullLabel, "Now")
        XCTAssertEqual(points[0].rate, 3.625, accuracy: 1e-12)

        XCTAssertEqual(points[1].label, "Jun 17")
        XCTAssertEqual(points[1].fullLabel, "Wed, Jun 17")
        XCTAssertEqual(points[1].rate, 3.375, accuracy: 1e-12) // 3.625 - 25/100

        XCTAssertEqual(points[2].label, "Jul 29")
        XCTAssertEqual(points[2].fullLabel, "Wed, Jul 29")
        XCTAssertEqual(points[2].rate, 3.625, accuracy: 1e-12) // chained off points[1]
    }

    func testCurvePointsCustomAnchorLabel() {
        let points = RateMath.curvePoints([], startingRate: 2.0, anchorLabel: "Jun 17: Hold")
        XCTAssertEqual(points.count, 1)
        XCTAssertEqual(points[0].label, "Jun 17: Hold")
        XCTAssertEqual(points[0].rate, 2.0, accuracy: 1e-12)
    }

    // MARK: - buildConditional (lib/scenario.ts)

    private var conditionalFixture: [MeetingProbabilities] {
        [
            snap("A", date: "2026-06-17", [
                outcome("-25bp", deltaBps: -25, probability: 0.3, rate: 3.375),
                outcome("Hold", deltaBps: 0, probability: 0.7, rate: 3.625),
            ]),
            snap("B", date: "2026-07-29", [
                outcome("Hold", deltaBps: 0, probability: 1, rate: 3.625),
            ]),
            snap("C", date: "2026-09-16", [
                outcome("Hold", deltaBps: 0, probability: 1, rate: 3.625),
            ]),
        ]
    }

    func testBuildConditionalFound() throws {
        let scenario = try XCTUnwrap(RateMath.buildConditional(
            snapshots: conditionalFixture, meetingId: "A", outcomeId: "o--25bp"
        ))
        XCTAssertEqual(scenario.startingRate, 3.375, accuracy: 1e-12)
        XCTAssertEqual(scenario.after.map(\.meeting.id), ["B", "C"])
        XCTAssertEqual(scenario.anchorLabel, "Jun 17: -25bp")
    }

    func testBuildConditionalMeetingOrOutcomeNotFoundIsNil() {
        XCTAssertNil(RateMath.buildConditional(
            snapshots: conditionalFixture, meetingId: "ZZZ", outcomeId: "o--25bp"
        ))
        XCTAssertNil(RateMath.buildConditional(
            snapshots: conditionalFixture, meetingId: "A", outcomeId: "o-+50bp"
        ))
    }

    func testBuildConditionalLastMeetingIsNil() {
        // No meetings after the conditioned one → no scenario.
        XCTAssertNil(RateMath.buildConditional(
            snapshots: conditionalFixture, meetingId: "C", outcomeId: "o-Hold"
        ))
    }

    // MARK: - computeMovements (lib/movement.ts baseline picking)

    func testComputeMovementsPicksLatestPointOnOrBeforeCutoff() throws {
        // Latest Jun 10, window 7d → cutoff Jun 3; only Jun 1 is on/before it.
        // Input deliberately unsorted: pickBaseline sorts by snapshot_at.
        let history = [series("Hold", [
            point(juneDay: 5, p: 0.40),
            point(juneDay: 1, p: 0.30),
            point(juneDay: 10, p: 0.50),
        ])]
        let movements = try XCTUnwrap(RateMath.computeMovements(history: history))

        let hold = try XCTUnwrap(movements.byLabel["Hold"])
        XCTAssertEqual(hold.deltaPp, 20.0, accuracy: 1e-9) // (0.50 - 0.30) · 100
        XCTAssertEqual(hold.baselineProbability, 0.30, accuracy: 1e-12)
        XCTAssertEqual(hold.windowDays, 9) // Jun 1 → Jun 10
        XCTAssertEqual(movements.windowDays, 9)
    }

    func testComputeMovementsPointExactlyAtCutoffIsBaseline() throws {
        // Cutoff Jun 3 exactly — "on or before" includes it.
        let history = [series("Hold", [
            point(juneDay: 3, p: 0.25),
            point(juneDay: 10, p: 0.45),
        ])]
        let hold = try XCTUnwrap(
            RateMath.computeMovements(history: history)?.byLabel["Hold"]
        )
        XCTAssertEqual(hold.baselineProbability, 0.25, accuracy: 1e-12)
        XCTAssertEqual(hold.deltaPp, 20.0, accuracy: 1e-9)
        XCTAssertEqual(hold.windowDays, 7)
    }

    func testComputeMovementsFallsBackToOldestPointInsideWindow() throws {
        // Nothing on/before the cutoff → baseline is the oldest point.
        let history = [series("Hold", [
            point(juneDay: 8, p: 0.20),
            point(juneDay: 10, p: 0.30),
        ])]
        let movements = try XCTUnwrap(RateMath.computeMovements(history: history))
        let hold = try XCTUnwrap(movements.byLabel["Hold"])
        XCTAssertEqual(hold.baselineProbability, 0.20, accuracy: 1e-12)
        XCTAssertEqual(hold.deltaPp, 10.0, accuracy: 1e-9)
        XCTAssertEqual(hold.windowDays, 2) // clamped to available data
        XCTAssertEqual(movements.windowDays, 2)
    }

    func testComputeMovementsSinglePointIsFlatWithRequestedWindow() throws {
        let history = [series("Hold", [point(juneDay: 10, p: 0.40)])]
        let movements = try XCTUnwrap(RateMath.computeMovements(history: history))
        let hold = try XCTUnwrap(movements.byLabel["Hold"])
        XCTAssertEqual(hold.deltaPp, 0, accuracy: 1e-12)
        XCTAssertEqual(hold.windowDays, 0)
        // maxActualWindow is 0 → falls back to the requested window (7).
        XCTAssertEqual(movements.windowDays, 7)
    }

    func testComputeMovementsKeysByLabelAndTakesMaxWindow() throws {
        let history = [
            series("Hold", [point(juneDay: 1, p: 0.6), point(juneDay: 10, p: 0.5)]),
            series("-25bp", deltaBps: -25, [point(juneDay: 8, p: 0.1), point(juneDay: 10, p: 0.2)]),
        ]
        let movements = try XCTUnwrap(RateMath.computeMovements(history: history))
        XCTAssertEqual(Set(movements.byLabel.keys), ["Hold", "-25bp"])
        XCTAssertEqual(movements.byLabel["Hold"]?.deltaPp ?? 0, -10.0, accuracy: 1e-9)
        XCTAssertEqual(movements.byLabel["-25bp"]?.deltaPp ?? 0, 10.0, accuracy: 1e-9)
        XCTAssertEqual(movements.windowDays, 9) // max(9, 2)
    }

    func testComputeMovementsNilOrEmptyHistoryIsNil() {
        XCTAssertNil(RateMath.computeMovements(history: nil))
        XCTAssertNil(RateMath.computeMovements(history: []))
        XCTAssertNil(RateMath.computeMovements(history: [series("Hold", [])]))
    }

    // MARK: - formatDelta (lib/movement.ts rounding)

    func testFormatDeltaRoundsToOneDecimal() {
        let up = RateMath.formatDelta(4.24)
        XCTAssertEqual(up.sign, .up)
        XCTAssertEqual(up.label, "+4.2pp")

        let down = RateMath.formatDelta(-3.14)
        XCTAssertEqual(down.sign, .down)
        XCTAssertEqual(down.label, "-3.1pp")
    }

    func testFormatDeltaFlatWhenRoundedToZero() {
        XCTAssertEqual(RateMath.formatDelta(0).sign, .flat)
        XCTAssertEqual(RateMath.formatDelta(0).label, "0.0pp")
        XCTAssertEqual(RateMath.formatDelta(0.04).sign, .flat)
        XCTAssertEqual(RateMath.formatDelta(-0.04).sign, .flat)
        XCTAssertEqual(RateMath.formatDelta(-0.04).label, "0.0pp")
    }

    func testFormatDeltaSmallButNonZeroKeepsSign() {
        let up = RateMath.formatDelta(0.06)
        XCTAssertEqual(up.sign, .up)
        XCTAssertEqual(up.label, "+0.1pp")

        let down = RateMath.formatDelta(-0.06)
        XCTAssertEqual(down.sign, .down)
        XCTAssertEqual(down.label, "-0.1pp")
    }
}
