"""Deterministic mock fetcher for dev + tests.

Returns realistic-looking Fed Funds Futures prices that produce sensible
implied probabilities when fed through `probability_calc`. Use during local
development and automated testing; never in production.

Default prices reflect a plausible late-2026 scenario: current Fed Funds
target range 4.25-4.50% (midpoint 4.375%), with markets pricing in gradual
cuts over the next 8 meetings.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from .base import BaseFetcher, ContractPrice


class MockFetcher(BaseFetcher):
    """Returns hardcoded plausible Fed Funds Futures settlement prices."""

    # Mapping: contract symbol → (price, contract_month_first_day)
    # Prices chosen so `100 - price` gives a rate consistent with a slow
    # cutting path starting mid-2026.
    DEFAULT_PRICES: ClassVar[dict[str, tuple[float, date]]] = {
        "ZQK26": (95.625, date(2026, 5, 1)),   # May 2026: rate ~4.375 (current level)
        "ZQM26": (95.685, date(2026, 6, 1)),   # June: ~4.315 (cut partially priced)
        "ZQN26": (95.810, date(2026, 7, 1)),   # July: ~4.190
        "ZQQ26": (95.870, date(2026, 8, 1)),   # Aug: ~4.130
        "ZQU26": (95.985, date(2026, 9, 1)),   # Sep: ~4.015
        "ZQV26": (96.065, date(2026, 10, 1)),  # Oct: ~3.935
        "ZQX26": (96.175, date(2026, 11, 1)),  # Nov: ~3.825
        "ZQZ26": (96.245, date(2026, 12, 1)),  # Dec: ~3.755
    }

    def __init__(self, as_of: date | None = None) -> None:
        self.as_of = as_of or date(2026, 4, 21)

    def fetch(self, symbols: list[str]) -> list[ContractPrice]:
        # Skip symbols we don't have prices for — matches real-world behavior
        # (a fetcher may lack data for historical contracts that already settled,
        # or contracts too far in the future to be quoted)
        results: list[ContractPrice] = []
        for sym in symbols:
            entry = self.DEFAULT_PRICES.get(sym)
            if entry is None:
                continue
            price, month = entry
            results.append(
                ContractPrice(symbol=sym, contract_month=month, price=price, as_of=self.as_of)
            )
        return results
