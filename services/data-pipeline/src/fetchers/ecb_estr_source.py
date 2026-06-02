"""Free, no-auth ECB spot-anchored fetcher.

The ECB has no FREE forward-implied source: €STR OIS and Euribor (FEU3) futures
forward curves are paid (Barchart/ICE/BlueGamma) or scrape-only, both ruled out
(NEVER pay, no scraping). What IS free and authoritative is the *spot* picture:
the current Deposit Facility Rate (DFR) and the €STR fixing, from the ECB Data
Portal (`data-api.ecb.europa.eu`, no auth) with a FRED CSV fallback.

So we anchor every upcoming ECB meeting at the current DFR — a flat "no change
priced forward" distribution — and label it honestly as
"spot-anchored — forward odds unavailable". This is low-information by design
(ECB history will be near-flat); that trade-off is accepted in exchange for
never paying and never scraping. See docs/METHODOLOGY.md §6.
"""

from __future__ import annotations

import csv
import io
import logging
from collections.abc import Callable
from datetime import date
from typing import ClassVar

from .base import BaseFetcher, ContractPrice
from .yfinance_source import MONTH_CODES


def parse_ecb_portal_csv_latest(csv_text: str) -> float:
    """Return the most recent OBS_VALUE from an ECB Data Portal `csvdata` response.

    The portal returns a header row containing an `OBS_VALUE` column and one row
    per observation in chronological order. We take the last parseable value.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    last: float | None = None
    for row in reader:
        raw = (row.get("OBS_VALUE") or "").strip()
        if not raw or raw == ".":
            continue
        try:
            last = float(raw)
        except ValueError:
            continue
    if last is None:
        raise ValueError("no parseable OBS_VALUE rows in ECB portal CSV")
    return last


def parse_fred_csv_latest(csv_text: str) -> float:
    """Return the most recent value from a FRED `fredgraph.csv` (no API key).

    FRED CSV is `<date_col>,<SERIES_ID>` with missing observations encoded as a
    literal ".". We take the last non-missing numeric value.
    """
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        raise ValueError("empty FRED CSV")
    # Last column is the series value; first row is the header.
    last: float | None = None
    for row in rows[1:]:
        if not row:
            continue
        raw = row[-1].strip()
        if not raw or raw == ".":
            continue
        try:
            last = float(raw)
        except ValueError:
            continue
    if last is None:
        raise ValueError("no parseable value rows in FRED CSV")
    return last


def estr_symbol_to_month(symbol: str) -> date:
    """Parse our internal ESTR symbol (e.g. 'ESTR_M26') into its contract month.

    Inverse of `ecb_fetcher.ecb_symbol_for_month`. 'ESTR_M26' → date(2026, 6, 1).
    """
    if not symbol.startswith("ESTR_") or len(symbol) < 8:
        raise ValueError(f"Invalid ESTR symbol: {symbol}")
    code = symbol[5]
    year_2 = symbol[6:8]
    if code not in MONTH_CODES:
        raise ValueError(f"Unknown month code '{code}' in symbol {symbol}")
    return date(2000 + int(year_2), MONTH_CODES[code], 1)


logger = logging.getLogger(__name__)

# ECB Data Portal series (no auth). DFR level + €STR volume-weighted trimmed mean.
_ECB_PORTAL = "https://data-api.ecb.europa.eu/service/data"
_DFR_URL = f"{_ECB_PORTAL}/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=1&format=csvdata"
_ESTR_URL = f"{_ECB_PORTAL}/EST/B.EU000A2X2A25.WT?lastNObservations=1&format=csvdata"
# FRED fallback (no API key via fredgraph.csv).
_FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id="
_FRED_DFR_URL = f"{_FRED}ECBDFR"
_FRED_ESTR_URL = f"{_FRED}ECBESTRVOLWGTTRMDMNRT"


def _default_http_get(url: str) -> str:
    import requests

    resp = requests.get(url, timeout=20, headers={"User-Agent": "RateRadar/1.0 (+pipeline)"})
    resp.raise_for_status()
    return resp.text


class EcbEstrFetcher(BaseFetcher):
    """Free ECB fetcher: real DFR + €STR spot → flat spot-anchored contracts.

    No forward-implied source is free for the ECB, so every upcoming meeting is
    anchored at the current DFR (no change priced) and the output is labeled
    "spot-anchored — forward odds unavailable". See module docstring + §6.
    """

    estimation_basis: ClassVar[str] = "spot-anchored — forward odds unavailable"
    DFR_FALLBACK: ClassVar[float] = 2.00  # ECB DFR as of 2026-04; last-resort anchor

    def __init__(
        self,
        *,
        http_get: Callable[[str], str] | None = None,
        dfr_override: float | None = None,
        as_of: date | None = None,
    ) -> None:
        self._http_get = http_get or _default_http_get
        self._dfr_override = dfr_override
        self.as_of = as_of or date.today()
        self._cached_rate: float | None = None

    def forward_curve_available(self) -> bool:
        """Best-effort check whether a FREE source beats spot. It does not.

        €STR OIS / Euribor (FEU3) forward curves are paid or scrape-only, both
        ruled out. We keep this as an explicit, honest hook rather than pretend
        a forward curve exists.
        """
        return False

    def current_policy_rate(self) -> float:
        """Live DFR midpoint (cached). ECB portal → FRED → documented fallback."""
        if self._dfr_override is not None:
            return self._dfr_override
        if self._cached_rate is not None:
            return self._cached_rate

        rate = self._fetch_rate(_DFR_URL, parse_ecb_portal_csv_latest, "ECB portal DFR")
        if rate is None:
            rate = self._fetch_rate(_FRED_DFR_URL, parse_fred_csv_latest, "FRED DFR")
        if rate is None:
            logger.warning(
                "All free DFR sources unavailable — anchoring at documented "
                "fallback %.3f%%. Spot-anchored output is degraded but honest.",
                self.DFR_FALLBACK,
            )
            rate = self.DFR_FALLBACK

        self._cached_rate = rate
        return rate

    def estr_spot(self) -> float | None:
        """Best-effort €STR fixing (informational). None on any failure."""
        rate = self._fetch_rate(_ESTR_URL, parse_ecb_portal_csv_latest, "ECB portal STR")
        if rate is None:
            rate = self._fetch_rate(_FRED_ESTR_URL, parse_fred_csv_latest, "FRED STR")
        return rate

    def _fetch_rate(self, url: str, parser: Callable[[str], float], label: str) -> float | None:
        try:
            return parser(self._http_get(url))
        except Exception as exc:  # noqa: BLE001 — degrade to next source, never abort
            logger.warning("%s fetch failed (%s); trying next source", label, exc)
            return None

    def fetch(self, symbols: list[str]) -> list[ContractPrice]:
        rate = self.current_policy_rate()
        price = 100.0 - rate  # inverse of implied_rate_from_price → implied avg == DFR
        results: list[ContractPrice] = []
        for sym in symbols:
            try:
                month = estr_symbol_to_month(sym)
            except ValueError:
                logger.warning("Skipping unrecognized ECB symbol %s", sym)
                continue
            results.append(
                ContractPrice(symbol=sym, contract_month=month, price=price, as_of=self.as_of)
            )
        return results
