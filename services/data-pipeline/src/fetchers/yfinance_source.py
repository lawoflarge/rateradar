"""yfinance-based fetcher for Fed Funds Futures.

CAVEATS:
- Yahoo Finance is aggressively rate-limited. In practice you can expect
  `YFRateLimitError` after a handful of rapid calls from the same IP.
- Recommended: use this as a *fallback*, not a primary, once a paid/registered
  data source (Polygon.io, Alpha Vantage, Stooq API key) is configured.
- Contract symbol convention on Yahoo: `ZQ{month_code}{year_2digit}.CBT`
  Month codes: F=Jan G=Feb H=Mar J=Apr K=May M=Jun N=Jul Q=Aug U=Sep V=Oct X=Nov Z=Dec

Example: `ZQM26.CBT` = Fed Funds Futures June 2026.
"""

from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from typing import ClassVar

import requests
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .base import BaseFetcher, ContractPrice

logger = logging.getLogger(__name__)

MONTH_CODES = {
    "F": 1, "G": 2, "H": 3, "J": 4, "K": 5, "M": 6,
    "N": 7, "Q": 8, "U": 9, "V": 10, "X": 11, "Z": 12,
}
MONTH_TO_CODE = {v: k for k, v in MONTH_CODES.items()}


def rateradar_symbol_to_yahoo(symbol: str) -> str:
    """Convert our internal symbol (e.g. 'ZQM26') to Yahoo's (e.g. 'ZQM26.CBT')."""
    if symbol.endswith(".CBT"):
        return symbol
    return f"{symbol}.CBT"


def parse_contract_month(symbol: str) -> date:
    """Parse contract month from an internal symbol like 'ZQM26' → date(2026, 6, 1)."""
    if not symbol.startswith("ZQ") or len(symbol) < 5:
        raise ValueError(f"Invalid ZQ symbol: {symbol}")
    month_code = symbol[2]
    year_2 = symbol[3:5]
    if month_code not in MONTH_CODES:
        raise ValueError(f"Unknown month code '{month_code}' in symbol {symbol}")
    month = MONTH_CODES[month_code]
    # Assume 2000s — fine for the 2020-2099 range we'll use
    year = 2000 + int(year_2)
    return date(year, month, 1)


class YFinanceFetcher(BaseFetcher):
    """Fetches Fed Funds Futures prices from Yahoo Finance via yfinance.

    Use sparingly — Yahoo rate-limits aggressively. Prefer a paid/registered
    source for production. This fetcher is here for development, sanity
    cross-checks, and as a fallback.
    """

    DEFAULT_UA: ClassVar[str] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    def __init__(self, per_call_delay_seconds: float = 1.5) -> None:
        self.per_call_delay_seconds = per_call_delay_seconds
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": self.DEFAULT_UA})

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=30),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def _fetch_one(self, yahoo_symbol: str) -> ContractPrice | None:
        import yfinance as yf  # imported lazily so tests don't hit the dependency

        ticker = yf.Ticker(yahoo_symbol, session=self._session)
        hist = ticker.history(period="5d")
        if hist.empty:
            logger.warning("yfinance returned empty for %s", yahoo_symbol)
            return None

        close = float(hist["Close"].iloc[-1])
        as_of_ts = hist.index[-1].to_pydatetime()
        as_of = as_of_ts.date() if hasattr(as_of_ts, "date") else date.today() - timedelta(days=1)

        internal_symbol = yahoo_symbol.replace(".CBT", "")
        return ContractPrice(
            symbol=internal_symbol,
            contract_month=parse_contract_month(internal_symbol),
            price=close,
            as_of=as_of,
        )

    def fetch(self, symbols: list[str]) -> list[ContractPrice]:
        results: list[ContractPrice] = []
        for sym in symbols:
            yahoo_sym = rateradar_symbol_to_yahoo(sym)
            try:
                price = self._fetch_one(yahoo_sym)
                if price is not None:
                    results.append(price)
            except Exception as exc:  # noqa: BLE001 — propagating would abort whole batch
                logger.error("yfinance fetch failed for %s: %s", yahoo_sym, exc)
            time.sleep(self.per_call_delay_seconds)
        return results
