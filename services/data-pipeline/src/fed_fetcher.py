"""High-level Fed-side fetcher.

Wires together:
- meeting calendar (from YAML)
- contract symbol resolution (which ZQ contracts cover the next N meetings)
- the configured price fetcher (any `PriceFetcher`)
- probability decomposition (from `probability_calc`)

The orchestrator (`main.py`) calls this, then writes snapshots to Supabase.
"""

from __future__ import annotations

import logging
from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import yaml

from .fetchers.base import ContractPrice, PriceFetcher
from .fetchers.yfinance_source import MONTH_TO_CODE
from .probability_calc import (
    Outcome,
    decompose_probabilities,
    implied_rate_from_price,
    solve_post_meeting_rate,
)

logger = logging.getLogger(__name__)

CALENDAR_DIR = Path(__file__).parent / "calendars"


@dataclass(frozen=True)
class MeetingProbability:
    """Computed probability for a single meeting outcome."""

    meeting_date: date
    outcome_label: str
    outcome_delta_bps: int
    probability: float
    post_meeting_rate: float


def load_meetings(bank: str, year: int) -> list[date]:
    """Read meeting decision dates from the YAML calendar file."""
    path = CALENDAR_DIR / f"{bank.lower()}_{year}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"No calendar at {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return [entry["date"] for entry in data["meetings"]]


def symbol_for_month(contract_month: date) -> str:
    """Build our internal ZQ symbol for a given contract month (e.g. 2026-06-01 → ZQM26)."""
    code = MONTH_TO_CODE[contract_month.month]
    year2 = contract_month.year % 100
    return f"ZQ{code}{year2:02d}"


def contracts_covering_meetings(meetings: list[date]) -> list[str]:
    """Return ZQ contract symbols for each meeting's month."""
    seen = set()
    result = []
    for meeting in meetings:
        sym = symbol_for_month(date(meeting.year, meeting.month, 1))
        if sym not in seen:
            seen.add(sym)
            result.append(sym)
    return result


def next_month_has_meeting(meeting: date, meetings: list[date]) -> bool:
    """True if the calendar month immediately after `meeting`'s month holds a meeting.

    Drives the §10 bracketing decision: if the next month has NO meeting, that
    month's contract average is the post-meeting rate (identity solve); if it
    does, we must solve within the meeting's own month (and may have to skip a
    late-month meeting whose tail is too small).
    """
    if meeting.month == 12:
        nxt_year, nxt_month = meeting.year + 1, 1
    else:
        nxt_year, nxt_month = meeting.year, meeting.month + 1
    return any(m.year == nxt_year and m.month == nxt_month for m in meetings)


def outcomes_around(current_rate: float, bps_range: int = 50) -> list[Outcome]:
    """Build a realistic outcome set centered on the current target rate.

    For a current target of 4.375%, returns outcomes for -50bp, -25bp, Hold, +25bp, +50bp.
    """
    outcomes: list[Outcome] = []
    for delta in range(-bps_range, bps_range + 1, 25):
        label = "Hold" if delta == 0 else ("+" if delta > 0 else "") + f"{delta}bp"
        new_rate = current_rate + delta / 100.0
        outcomes.append(Outcome(label=label, delta_bps=delta, post_meeting_rate=new_rate))
    return outcomes


def compute_meeting_probabilities(
    meetings: list[date],
    contract_prices: list[ContractPrice],
    current_target_midpoint: float,
) -> list[MeetingProbability]:
    """For each upcoming meeting, compute probabilities of each possible outcome.

    MVP simplification: uses a single contract per meeting to solve for the
    implied post-meeting rate. This works for meetings near the start/middle of
    their month but amplifies noise for late-month meetings (see METHODOLOGY.md
    §10 for the planned production fix using cross-contract anchoring).
    """
    price_by_month = {p.contract_month: p for p in contract_prices}
    results: list[MeetingProbability] = []
    rate_before = current_target_midpoint

    for meeting in meetings:
        contract_month = date(meeting.year, meeting.month, 1)
        price = price_by_month.get(contract_month)
        if price is None:
            logger.warning("No contract price for meeting %s", meeting)
            continue

        # CME: implied monthly-average rate = 100 - price
        implied_avg = implied_rate_from_price(price.price)

        # Solve for the market-implied post-meeting rate
        days_in_month = monthrange(meeting.year, meeting.month)[1]
        meeting_day = meeting.day
        try:
            expected_post_rate = solve_post_meeting_rate(
                observed_monthly_avg=implied_avg,
                rate_before_meeting=rate_before,
                meeting_day=meeting_day,
                days_in_month=days_in_month,
            )
        except ValueError as exc:
            logger.error("Could not solve post-meeting rate for %s: %s", meeting, exc)
            continue

        # Build the outcome set around the pre-meeting rate
        outcomes = outcomes_around(rate_before, bps_range=50)
        probs = decompose_probabilities(expected_post_rate, outcomes)

        for outcome, prob in zip(outcomes, probs, strict=True):
            results.append(
                MeetingProbability(
                    meeting_date=meeting,
                    outcome_label=outcome.label,
                    outcome_delta_bps=outcome.delta_bps,
                    probability=prob,
                    post_meeting_rate=outcome.post_meeting_rate,
                )
            )

        # Chain: the expected post-rate becomes the pre-rate for the next meeting
        rate_before = expected_post_rate

    return results


def run_fed_fetch(
    fetcher: PriceFetcher,
    current_target_midpoint: float,
    year: int = 2026,
) -> list[MeetingProbability]:
    """Top-level entrypoint — returns a flat list of computed probabilities."""
    meetings = load_meetings("fed", year)
    symbols = contracts_covering_meetings(meetings)
    prices = fetcher.fetch(symbols)
    return compute_meeting_probabilities(meetings, prices, current_target_midpoint)
