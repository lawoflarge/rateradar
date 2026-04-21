"""High-level ECB-side fetcher.

Mirrors `fed_fetcher.py` but with:
- ECB meeting calendar
- €STR OIS-style pseudo-contracts (symbol prefix `ESTR_`)
- Lower anchor rate (DFR midpoint ~ 2.00% as of Apr 2026)

Shares the pure math in `probability_calc.py` with the Fed pipeline.
"""

from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date
from pathlib import Path

import yaml

from .fed_fetcher import (
    MeetingProbability,
    compute_meeting_probabilities as _compute_meeting_probabilities,
    outcomes_around as _outcomes_around,
)
from .fetchers.base import PriceFetcher
from .fetchers.yfinance_source import MONTH_TO_CODE
from .probability_calc import (
    implied_rate_from_price,
    solve_post_meeting_rate,
)

logger = logging.getLogger(__name__)

CALENDAR_DIR = Path(__file__).parent / "calendars"


def load_ecb_meetings(year: int) -> list[date]:
    """Read ECB meeting decision dates from the YAML calendar."""
    path = CALENDAR_DIR / f"ecb_{year}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"No ECB calendar at {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    # Skip past (completed) meetings
    return [
        entry["date"]
        for entry in data["meetings"]
        if entry.get("status", "scheduled") == "scheduled"
    ]


def ecb_symbol_for_month(contract_month: date) -> str:
    """Build our internal ESTR symbol for a contract month (e.g. 2026-06-01 → ESTR_M26)."""
    code = MONTH_TO_CODE[contract_month.month]
    year2 = contract_month.year % 100
    return f"ESTR_{code}{year2:02d}"


def ecb_contracts_covering_meetings(meetings: list[date]) -> list[str]:
    seen = set()
    result = []
    for meeting in meetings:
        sym = ecb_symbol_for_month(date(meeting.year, meeting.month, 1))
        if sym not in seen:
            seen.add(sym)
            result.append(sym)
    return result


def run_ecb_fetch(
    fetcher: PriceFetcher,
    current_target: float = 2.00,
    year: int = 2026,
) -> list[MeetingProbability]:
    """Top-level entrypoint mirroring `run_fed_fetch` for the ECB.

    `current_target` is the ECB Deposit Facility Rate midpoint (percent).
    """
    meetings = load_ecb_meetings(year)
    symbols = ecb_contracts_covering_meetings(meetings)
    prices = fetcher.fetch(symbols)
    return _compute_meeting_probabilities(meetings, prices, current_target)


# Re-export for symmetry with fed_fetcher
__all__ = [
    "MeetingProbability",
    "ecb_contracts_covering_meetings",
    "ecb_symbol_for_month",
    "load_ecb_meetings",
    "run_ecb_fetch",
]
