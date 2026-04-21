"""Unit tests for probability_calc. Pure math, no I/O — fast and deterministic."""

from __future__ import annotations

import pytest

from src.probability_calc import (
    Outcome,
    decompose_probabilities,
    implied_rate_from_price,
    monthly_avg_rate,
    solve_post_meeting_rate,
)


def test_implied_rate_from_price():
    # CME standard: 100 - price = implied rate
    assert implied_rate_from_price(95.75) == pytest.approx(4.25)
    assert implied_rate_from_price(100.0) == pytest.approx(0.0)
    assert implied_rate_from_price(99.5) == pytest.approx(0.5)


def test_monthly_avg_rate_mid_month_meeting():
    # 30-day month, meeting on day 15, rate goes from 5.00 to 4.75
    # Expected average: 0.5 * 5.00 + 0.5 * 4.75 = 4.875
    avg = monthly_avg_rate(
        rate_before_meeting=5.00,
        rate_after_meeting=4.75,
        meeting_day=15,
        days_in_month=30,
    )
    assert avg == pytest.approx(4.875)


def test_monthly_avg_rate_no_change():
    # If rate stays the same, average equals that rate regardless of meeting day
    avg = monthly_avg_rate(4.50, 4.50, meeting_day=10, days_in_month=30)
    assert avg == pytest.approx(4.50)


def test_monthly_avg_rate_invalid_days():
    with pytest.raises(ValueError):
        monthly_avg_rate(4.5, 4.5, 10, 0)


def test_solve_post_meeting_rate_round_trip():
    # Solving for post-meeting should recover the value used to build the average
    pre = 5.00
    post = 4.75
    day = 15
    days = 30
    avg = monthly_avg_rate(pre, post, day, days)
    recovered = solve_post_meeting_rate(avg, pre, day, days)
    assert recovered == pytest.approx(post)


def test_solve_post_meeting_rate_last_day_raises():
    with pytest.raises(ValueError):
        solve_post_meeting_rate(4.5, 5.0, meeting_day=30, days_in_month=30)


def test_decompose_probabilities_two_outcomes_hold_vs_cut():
    # Expected post-rate is 4.40, between 4.25 (cut) and 4.50 (hold)
    # p_cut = (4.50 - 4.40) / 0.25 = 0.40, p_hold = 0.60
    outcomes = [
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.25),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.50),
    ]
    probs = decompose_probabilities(4.40, outcomes)
    assert probs[0] == pytest.approx(0.40)
    assert probs[1] == pytest.approx(0.60)


def test_decompose_probabilities_exact_outcome():
    # Expected rate exactly matches one outcome — that outcome gets 100%
    outcomes = [
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.25),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.50),
    ]
    probs = decompose_probabilities(4.50, outcomes)
    assert probs[0] == pytest.approx(0.0)
    assert probs[1] == pytest.approx(1.0)


def test_decompose_probabilities_below_range():
    # Expected rate below all outcomes — lowest outcome gets 100%
    outcomes = [
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.25),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.50),
    ]
    probs = decompose_probabilities(4.00, outcomes)
    assert probs[0] == pytest.approx(1.0)
    assert probs[1] == pytest.approx(0.0)


def test_decompose_probabilities_above_range():
    outcomes = [
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.25),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.50),
    ]
    probs = decompose_probabilities(5.00, outcomes)
    assert probs[0] == pytest.approx(0.0)
    assert probs[1] == pytest.approx(1.0)


def test_decompose_probabilities_three_outcomes():
    # Three outcomes; expected rate falls between middle and top
    outcomes = [
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.00),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.25),
        Outcome(label="+25bp", delta_bps=25, post_meeting_rate=4.50),
    ]
    # Expected rate 4.35 → 60% hold, 40% hike, 0% cut
    probs = decompose_probabilities(4.35, outcomes)
    assert probs[0] == pytest.approx(0.0)
    assert probs[1] == pytest.approx(0.60)
    assert probs[2] == pytest.approx(0.40)


def test_decompose_probabilities_sums_to_one():
    outcomes = [
        Outcome(label="-50bp", delta_bps=-50, post_meeting_rate=3.75),
        Outcome(label="-25bp", delta_bps=-25, post_meeting_rate=4.00),
        Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.25),
        Outcome(label="+25bp", delta_bps=25, post_meeting_rate=4.50),
    ]
    for expected in [3.50, 3.80, 4.10, 4.25, 4.40, 5.00]:
        probs = decompose_probabilities(expected, outcomes)
        assert sum(probs) == pytest.approx(1.0), f"Failed at expected={expected}"


def test_decompose_empty_raises():
    with pytest.raises(ValueError):
        decompose_probabilities(4.5, [])


def test_decompose_single_outcome_always_certain():
    outcomes = [Outcome(label="Hold", delta_bps=0, post_meeting_rate=4.50)]
    probs = decompose_probabilities(4.00, outcomes)
    assert probs == [1.0]
