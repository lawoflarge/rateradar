"""Futures-price fetchers, abstracted by source.

Source abstraction lets us swap between yfinance, Stooq, Polygon.io, Alpha Vantage,
or a deterministic mock — without the orchestrator caring which one is live.
"""

from .base import ContractPrice, PriceFetcher
from .mock_source import MockFetcher

__all__ = ["ContractPrice", "PriceFetcher", "MockFetcher"]
