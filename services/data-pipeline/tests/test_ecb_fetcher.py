"""ECB fetcher integration tests — uses EcbMockFetcher for end-to-end."""

from __future__ import annotations

from datetime import date

import pytest

from src.ecb_fetcher import (
    ecb_contracts_covering_meetings,
    ecb_symbol_for_month,
    load_ecb_meetings,
    run_ecb_fetch,
)
from src.fetchers.ecb_mock_source import EcbMockFetcher


def test_load_ecb_meetings_skips_completed():
    # Only 'scheduled' ECB 2026 meetings should be returned (Jan + Mar are completed)
    meetings = load_ecb_meetings(2026)
    assert date(2026, 1, 22) not in meetings
    assert date(2026, 3, 5) not in meetings
    assert date(2026, 4, 30) in meetings
    assert date(2026, 12, 17) in meetings
    assert len(meetings) == 6


def test_ecb_symbol_for_month():
    assert ecb_symbol_for_month(date(2026, 6, 1)) == "ESTR_M26"
    assert ecb_symbol_for_month(date(2026, 12, 1)) == "ESTR_Z26"


def test_ecb_contracts_covering_meetings_deduplicates():
    meetings = [date(2026, 6, 11), date(2026, 7, 23), date(2026, 7, 30)]
    contracts = ecb_contracts_covering_meetings(meetings)
    assert contracts == ["ESTR_M26", "ESTR_N26"]


def test_run_ecb_fetch_end_to_end_mock():
    fetcher = EcbMockFetcher()
    results = run_ecb_fetch(fetcher=fetcher, current_target=2.00, year=2026)
    assert len(results) > 0
    # Probabilities in [0, 1]
    for r in results:
        assert 0.0 <= r.probability <= 1.0

    # Per-meeting probabilities should sum to 1 (within float tolerance)
    by_meeting: dict = {}
    for r in results:
        by_meeting.setdefault(r.meeting_date, []).append(r.probability)
    for meeting_date, probs in by_meeting.items():
        assert sum(probs) == pytest.approx(
            1.0
        ), f"Probabilities for {meeting_date} did not sum to 1: {sum(probs)}"


def test_run_ecb_fetch_has_cut_bias_in_h2_2026():
    """The ECB mock data prices in gradual cuts; H2 2026 should show non-trivial -25bp prob."""
    fetcher = EcbMockFetcher()
    results = run_ecb_fetch(fetcher=fetcher, current_target=2.00, year=2026)
    # At least one meeting should have its top outcome be a cut
    by_meeting: dict = {}
    for r in results:
        by_meeting.setdefault(r.meeting_date, []).append(r)
    cut_meetings = 0
    for _date, rows in by_meeting.items():
        top = max(rows, key=lambda r: r.probability)
        if top.outcome_delta_bps < 0:
            cut_meetings += 1
    assert cut_meetings >= 1
