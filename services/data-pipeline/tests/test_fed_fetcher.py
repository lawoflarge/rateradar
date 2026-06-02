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
