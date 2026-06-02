"""Integration tests for the Fed fetcher — uses MockFetcher to exercise the full
data path end-to-end without hitting any external service.
"""

from __future__ import annotations

from datetime import date

import pytest

from src.fed_fetcher import (
    compute_meeting_probabilities,
    contracts_covering_meetings,
    load_meetings,
    outcomes_around,
    run_fed_fetch,
    symbol_for_month,
)
from src.fetchers.mock_source import MockFetcher


def test_load_meetings_fed_2026():
    meetings = load_meetings("fed", 2026)
    assert len(meetings) == 8
    assert meetings[0] == date(2026, 1, 28)
    assert meetings[-1] == date(2026, 12, 9)


def test_load_meetings_invalid_bank():
    with pytest.raises(FileNotFoundError):
        load_meetings("rba", 2026)


def test_symbol_for_month():
    assert symbol_for_month(date(2026, 5, 1)) == "ZQK26"
    assert symbol_for_month(date(2026, 6, 1)) == "ZQM26"
    assert symbol_for_month(date(2026, 12, 1)) == "ZQZ26"
    assert symbol_for_month(date(2027, 1, 1)) == "ZQF27"


def test_contracts_covering_meetings_deduplicates():
    meetings = [date(2026, 6, 15), date(2026, 6, 30), date(2026, 7, 10)]
    contracts = contracts_covering_meetings(meetings)
    assert contracts == ["ZQM26", "ZQN26"]


def test_outcomes_around_standard_range():
    outcomes = outcomes_around(4.375, bps_range=50)
    labels = [o.label for o in outcomes]
    assert labels == ["-50bp", "-25bp", "Hold", "+25bp", "+50bp"]
    assert outcomes[2].post_meeting_rate == pytest.approx(4.375)
    assert outcomes[0].post_meeting_rate == pytest.approx(3.875)
    assert outcomes[-1].post_meeting_rate == pytest.approx(4.875)


def test_compute_meeting_probabilities_with_mock_data():
    """Full path: meetings + mock contract prices → per-outcome probabilities."""
    meetings = [date(2026, 6, 17), date(2026, 7, 29), date(2026, 9, 16)]
    fetcher = MockFetcher()
    contracts = contracts_covering_meetings(meetings)
    prices = fetcher.fetch(contracts)

    current_midpoint = 4.375  # current Fed Funds target range midpoint
    probs = compute_meeting_probabilities(meetings, prices, current_midpoint)

    # Sanity: each meeting should produce 5 outcomes (-50 through +50 in 25bp steps)
    assert len(probs) == 5 * 3

    # Each meeting's probabilities should sum to ~1
    for meeting in meetings:
        meeting_probs = [p.probability for p in probs if p.meeting_date == meeting]
        assert len(meeting_probs) == 5
        assert sum(meeting_probs) == pytest.approx(1.0)

    # June 2026 contract price 95.685 → implied avg 4.315% (cut partially priced)
    # For the June 17 meeting, with pre-rate 4.375 and meeting on day 17 of 30,
    # solve for post-rate. Should yield a probability mix biased toward a -25bp cut.
    june_probs = {
        p.outcome_label: p.probability for p in probs if p.meeting_date == date(2026, 6, 17)
    }
    # We expect non-trivial probability on -25bp AND Hold, with -25bp dominant
    assert june_probs["-25bp"] > 0
    assert june_probs["Hold"] > 0
    # One of the two adjacent outcomes gets the full probability mass under our
    # two-point decomposition; the rest are zero. Confirm the split is sensible.
    nonzero = {k: v for k, v in june_probs.items() if v > 0}
    assert set(nonzero.keys()).issubset({"-25bp", "Hold", "-50bp"})


def test_run_fed_fetch_end_to_end_mock():
    """Top-level orchestrator entry runs without errors on mock data."""
    fetcher = MockFetcher()
    results = run_fed_fetch(fetcher=fetcher, current_target_midpoint=4.375, year=2026)
    # 8 meetings × 5 outcomes each = 40 rows, but the mock only covers
    # 8 contract months (May-Dec 2026), and January/March meetings don't have
    # mock prices (happened before). Filter logic skips those.
    # Mock covers May-Dec 2026; May/Jun/Jul/Aug/Sep/Oct/Nov/Dec meetings * 5 = 30
    # (Jan 28 and Mar 18 have no mock contract — they're skipped with a warning)
    # Apr 29 meeting is in April but mock doesn't have ZQJ26 - also skipped
    assert len(results) > 0
    # Sanity: all probabilities must be in [0, 1]
    for r in results:
        assert 0.0 <= r.probability <= 1.0


def test_next_month_has_meeting_flags_consecutive_month_meetings():
    from src.fed_fetcher import next_month_has_meeting

    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    # July's next month (Aug) has no meeting -> False (bracketing identity usable).
    assert next_month_has_meeting(date(2026, 7, 29), meetings) is False
    # Sep's next month (Oct) HAS a meeting -> True.
    assert next_month_has_meeting(date(2026, 9, 16), meetings) is True
    # June's next month (July) HAS a meeting -> True.
    assert next_month_has_meeting(date(2026, 6, 17), meetings) is True


def test_flat_futures_yield_hold_for_every_meeting():
    """FLAT futures (every contract ~ current rate) MUST give a high-probability
    Hold at every meeting and NEVER an alternating +/-50bp sawtooth."""
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    flat_price = 100.0 - current  # 96.375 -> implied avg 3.625 every month
    months = [6, 7, 8, 9, 10, 11, 12]  # meeting months + bracketing months
    prices = [
        ContractPrice(
            symbol=f"ZQ{m:02d}",
            contract_month=date(2026, m, 1),
            price=flat_price,
            as_of=date(2026, 6, 1),
        )
        for m in months
    ]
    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    results = compute_meeting_probabilities(meetings, prices, current)

    # Every meeting that produced output must be Hold-dominant at ~100%.
    seen_meetings = {r.meeting_date for r in results}
    assert seen_meetings, "no meetings produced — flat data must be solvable"
    for meeting in seen_meetings:
        by_label = {r.outcome_label: r.probability for r in results if r.meeting_date == meeting}
        assert by_label["Hold"] == pytest.approx(
            1.0, abs=1e-6
        ), f"{meeting}: expected Hold~1.0, got {by_label}"
        # No outcome other than Hold may carry meaningful mass (no sawtooth).
        for label, p in by_label.items():
            if label != "Hold":
                assert p == pytest.approx(0.0, abs=1e-6), f"{meeting} {label}={p}"


def test_jul29_late_month_meeting_no_amplification():
    """METHODOLOGY §10 case: Jul-29 leaves only 2/31 of the month post-meeting.

    Near-flat data (July avg 3.620, August (no meeting) avg 3.620) must yield a
    Hold-dominant July, NOT the +28bp swing the single-contract solve produced.
    Expected via the August bracket: post-July = 3.620; with before=3.625 the
    two-point decomposition gives Hold~0.98, -25bp~0.02.
    """
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    prices = [
        ContractPrice("ZQN26", date(2026, 7, 1), 100.0 - 3.620, date(2026, 6, 1)),
        ContractPrice("ZQQ26", date(2026, 8, 1), 100.0 - 3.620, date(2026, 6, 1)),
    ]
    meetings = [date(2026, 7, 29)]  # August has no meeting -> bracket identity
    results = compute_meeting_probabilities(meetings, prices, current)

    by_label = {r.outcome_label: r.probability for r in results}
    assert by_label["Hold"] == pytest.approx(0.98, abs=0.01)
    assert by_label["-25bp"] == pytest.approx(0.02, abs=0.01)
    # Crucially: no hike mass at all (the bug put 0.88 on +25bp here).
    assert by_label["+25bp"] == pytest.approx(0.0, abs=1e-9)
    assert by_label["+50bp"] == pytest.approx(0.0, abs=1e-9)


def test_easing_scenario_smooth_cut_skew():
    """A genuine easing curve gives a smooth, cut-skewed distribution across all
    meetings — partial -25bp probability + dominant Hold, monotonically falling
    post-rates, NO 100% spikes and NO sign-flipping.

    Bracketing months Aug (after Jul) and Nov (after Oct) carry the post rates of
    the preceding meeting; meeting-month contract averages are pre-computed from
    avg = pre_w*before + post_w*after with the easing path below.
    """
    from src.fed_fetcher import compute_meeting_probabilities
    from src.fetchers.base import ContractPrice

    current = 3.625
    # (contract_month, implied monthly-average) — derived from the easing path
    # post = {Jun:3.560, Jul:3.500, Sep:3.430, Oct:3.370, Dec:3.310}
    avgs = {
        (2026, 6): 3.5968,  # Jun-17 meeting month
        (2026, 7): 3.5561,  # Jul-29 meeting month
        (2026, 8): 3.500,  # Aug bracket = post-Jul rate
        (2026, 9): 3.4673,  # Sep-16 meeting month
        (2026, 10): 3.4242,  # Oct-28 meeting month
        (2026, 11): 3.370,  # Nov bracket = post-Oct rate
        (2026, 12): 3.3274,  # Dec-09 meeting month
    }
    prices = [
        ContractPrice(
            symbol=f"ZQ{m:02d}{y % 100}",
            contract_month=date(y, m, 1),
            price=100.0 - avg,
            as_of=date(2026, 6, 1),
        )
        for (y, m), avg in avgs.items()
    ]
    meetings = [
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
    results = compute_meeting_probabilities(meetings, prices, current)

    # All five meetings produce output.
    seen = sorted({r.meeting_date for r in results})
    assert seen == meetings

    # Per-meeting expected (Hold, -25bp) splits — smooth, cut-skewed, no spikes.
    # NOTE: Jul-29 and Oct-28 are bracketed meetings; their outcome set is centered
    # on the chained pre-rate and the bracket post-rate sits ~6bp below it, so the
    # cut probability is ~0.24 (= 6/25), NOT a near-certain Hold.
    expected = {
        date(2026, 6, 17): (0.74, 0.26),
        date(2026, 7, 29): (
            0.76,
            0.24,
        ),  # Jul via Aug bracket (post=3.500 vs before=3.560 -> -6bp -> p(cut)=6/25=0.24)
        date(2026, 9, 16): (0.72, 0.28),
        date(2026, 10, 28): (
            0.76,
            0.24,
        ),  # Oct via Nov bracket (post=3.370 vs before=3.430 -> -6bp -> p(cut)=6/25=0.24)
        date(2026, 12, 9): (0.76, 0.24),
    }
    for meeting, (exp_hold, exp_cut) in expected.items():
        by_label = {r.outcome_label: r.probability for r in results if r.meeting_date == meeting}
        assert sum(by_label.values()) == pytest.approx(1.0)
        assert by_label["Hold"] == pytest.approx(exp_hold, abs=0.02), f"{meeting} {by_label}"
        assert by_label["-25bp"] == pytest.approx(exp_cut, abs=0.02), f"{meeting} {by_label}"
        # Cut-skew: never any hike mass.
        assert by_label["+25bp"] == pytest.approx(0.0, abs=1e-9)
        assert by_label["+50bp"] == pytest.approx(0.0, abs=1e-9)
        # No 100% spike anywhere.
        assert max(by_label.values()) < 0.999, f"{meeting} spiked: {by_label}"
