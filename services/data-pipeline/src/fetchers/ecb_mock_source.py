"""Deterministic mock fetcher for ECB €STR-implied rates.

ECB doesn't have contract-month futures the way the Fed does; traders price
short-dated €STR OIS instead. For scaffold purposes we create a pseudo-contract
per month keyed by `ESTR_<month_code><year>` whose "price" maps to the
market-implied monthly-average rate via the same `100 - price` convention used
for Fed Funds Futures. Keeps the downstream `probability_calc` code bank-agnostic.

Default prices reflect a plausible 2026 scenario: DFR starts at 2.00% with
markets pricing in gradual cuts. €STR typically trades ~5-10 bps below DFR; we
use the DFR itself as the cleanest anchor for MVP math.
"""

from __future__ import annotations

from datetime import date
from typing import ClassVar

from .base import BaseFetcher, ContractPrice


class EcbMockFetcher(BaseFetcher):
    """Mocked €STR-implied rates for each ECB meeting's contract month."""

    DEFAULT_PRICES: ClassVar[dict[str, tuple[float, date]]] = {
        # Apr 2026 (already past Apr 22 meeting, included for robustness)
        "ESTR_J26": (98.00, date(2026, 4, 1)),  # Apr 2026: DFR ~2.00
        "ESTR_K26": (98.00, date(2026, 5, 1)),  # May
        "ESTR_M26": (98.07, date(2026, 6, 1)),  # June: slight easing priced
        "ESTR_N26": (98.20, date(2026, 7, 1)),  # July
        "ESTR_Q26": (98.33, date(2026, 8, 1)),  # Aug
        "ESTR_U26": (98.47, date(2026, 9, 1)),  # Sep
        "ESTR_V26": (98.60, date(2026, 10, 1)),  # Oct
        "ESTR_X26": (98.72, date(2026, 11, 1)),  # Nov
        "ESTR_Z26": (98.83, date(2026, 12, 1)),  # Dec: ~1.17% by year-end
    }

    def __init__(self, as_of: date | None = None) -> None:
        self.as_of = as_of or date(2026, 4, 21)

    def fetch(self, symbols: list[str]) -> list[ContractPrice]:
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
