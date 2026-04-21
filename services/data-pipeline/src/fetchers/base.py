"""Abstract interface every price-fetcher implements.

Keeping this minimal on purpose — any new data source (Polygon, Alpha Vantage,
Stooq) just needs to return `ContractPrice` records for the requested symbols.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(frozen=True)
class ContractPrice:
    """One Fed Funds Futures contract's latest settlement price."""

    symbol: str  # e.g. "ZQM26" (Fed Funds Futures, June 2026)
    contract_month: date  # first day of the contract month (e.g. 2026-06-01)
    price: float  # settlement price (e.g. 95.75 → implied rate 4.25%)
    as_of: date  # the session date this price represents


class PriceFetcher(Protocol):
    """Any class implementing `fetch` is a valid price fetcher."""

    def fetch(self, symbols: list[str]) -> list[ContractPrice]: ...


class BaseFetcher(ABC):
    """Optional convenience base class for implementations that want shared behavior."""

    @abstractmethod
    def fetch(self, symbols: list[str]) -> list[ContractPrice]:
        """Return latest settlement prices for the given contract symbols."""
        ...
