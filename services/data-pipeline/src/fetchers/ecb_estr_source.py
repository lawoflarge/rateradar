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
from datetime import date

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
