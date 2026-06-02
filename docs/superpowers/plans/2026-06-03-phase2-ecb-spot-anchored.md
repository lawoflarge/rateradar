# Phase 2 — ECB Free Spot-Anchored Fetcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free, no-auth ECB fetcher (`EcbEstrFetcher`) that pulls the real Deposit Facility Rate (DFR) + €STR spot from the ECB Data Portal (FRED CSV fallback) and emits an honest **spot-anchored** outcome distribution labeled "spot-anchored — forward odds unavailable", wired into `build_fetcher` and the methodology.

**Architecture:** ECB has no free forward-implied source (€STR OIS / Euribor futures are paid/scrape-only). So the fetcher anchors every future meeting at the current DFR — a flat "no change priced" distribution — and labels it honestly. The HTTP layer is injectable so unit tests never touch the network; pure CSV parsers are tested with fixtures; the live fetch degrades ECB Data Portal → FRED → documented default. The pure probability math in `probability_calc.py` is unchanged and untouched.

**Tech Stack:** Python 3.11, `requests` (already a dep), `pytest`, `black`, `ruff`. ECB Data Portal `data-api.ecb.europa.eu` (no auth), FRED `fredgraph.csv` (no key).

**Working dir for all commands:** `services/data-pipeline` (run via `.venv/bin/python`).

---

## File structure

- **Create** `src/fetchers/ecb_estr_source.py` — `EcbEstrFetcher` + pure parsers + symbol→month helper. One responsibility: turn free ECB spot data into flat `ContractPrice` records with an honest basis label.
- **Create** `tests/test_ecb_estr_source.py` — unit tests (pure parsers + injected-HTTP fetcher behavior).
- **Modify** `src/main.py` — add `estr` source, wire `build_fetcher`, resolve+print estimation basis, use real DFR as ECB current-rate, thread basis into the JSON snapshot, bump `METHODOLOGY_VERSION`.
- **Modify** `src/json_writer.py` — accept optional `estimation_basis` and include it in the payload.
- **Modify** `tests/test_json_writer.py` — assert the basis appears in the payload.
- **Modify** `docs/METHODOLOGY.md` — §6 spot-anchored note + §11 changelog + version.

> **Out of scope (do NOT touch):** `probability_calc.py` (stays pure, unchanged), `fed_fetcher.py` math, the `methodology_version` default-arg fix in `json_writer.py:42` (that is Phase 3), the cron yml (Phase 3), the web UI (Phase 3 surfaces `/api/status`).

---

## Task 1: Pure helpers — CSV parsers + ESTR symbol→month

**Files:**
- Create: `src/fetchers/ecb_estr_source.py` (parsers only this task)
- Test: `tests/test_ecb_estr_source.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_ecb_estr_source.py
"""Unit tests for the free ECB spot-anchored fetcher."""

from __future__ import annotations

from datetime import date

import pytest

from src.fetchers.ecb_estr_source import (
    estr_symbol_to_month,
    parse_ecb_portal_csv_latest,
    parse_fred_csv_latest,
)


def test_parse_ecb_portal_csv_latest_returns_last_obs_value():
    # ECB Data Portal `format=csvdata` style: header + rows, OBS_VALUE column.
    csv_text = (
        "KEY,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\n"
        "FM.D.U2.EUR.4F.KR.DFR.LEV,D,U2,2026-05-29,2.00\n"
        "FM.D.U2.EUR.4F.KR.DFR.LEV,D,U2,2026-06-01,2.00\n"
    )
    assert parse_ecb_portal_csv_latest(csv_text) == pytest.approx(2.00)


def test_parse_ecb_portal_csv_latest_handles_estr_decimals():
    csv_text = "KEY,TIME_PERIOD,OBS_VALUE\nEST.B.EU000A2X2A25.WT,2026-06-01,1.918\n"
    assert parse_ecb_portal_csv_latest(csv_text) == pytest.approx(1.918)


def test_parse_ecb_portal_csv_latest_raises_on_no_rows():
    with pytest.raises(ValueError):
        parse_ecb_portal_csv_latest("KEY,TIME_PERIOD,OBS_VALUE\n")


def test_parse_fred_csv_latest_returns_last_nonempty_value():
    # FRED fredgraph.csv style: DATE,<SERIES_ID>
    csv_text = "observation_date,ECBDFR\n2026-05-01,2.00\n2026-06-01,2.00\n"
    assert parse_fred_csv_latest(csv_text) == pytest.approx(2.00)


def test_parse_fred_csv_latest_skips_missing_dot_values():
    # FRED encodes missing observations as a literal "." — skip them.
    csv_text = "observation_date,ECBESTRVOLWGTTRMDMNRT\n2026-05-30,1.920\n2026-05-31,.\n"
    assert parse_fred_csv_latest(csv_text) == pytest.approx(1.920)


def test_estr_symbol_to_month_parses_code_and_year():
    assert estr_symbol_to_month("ESTR_M26") == date(2026, 6, 1)
    assert estr_symbol_to_month("ESTR_Z26") == date(2026, 12, 1)


def test_estr_symbol_to_month_rejects_bad_symbol():
    with pytest.raises(ValueError):
        estr_symbol_to_month("ZQM26")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q`
Expected: FAIL with `ModuleNotFoundError` / `ImportError` (module not yet created).

- [ ] **Step 3: Write minimal implementation (parsers + symbol helper)**

```python
# src/fetchers/ecb_estr_source.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Format + lint the new file**

Run: `.venv/bin/black src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py && .venv/bin/ruff check src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py`
Expected: black "reformatted/unchanged", ruff "All checks passed!".

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py
git commit -m "feat(ecb): pure CSV parsers + ESTR symbol month for spot fetcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `EcbEstrFetcher` — flat spot-anchored contracts + honest basis

**Files:**
- Modify: `src/fetchers/ecb_estr_source.py` (add the class)
- Test: `tests/test_ecb_estr_source.py` (add class tests)

**Design contract:**
- `__init__(self, *, http_get=None, dfr_override=None, as_of=None)` — `http_get: Callable[[str], str]` returns response text for a URL; defaults to a real `requests`-based getter. `dfr_override` pins the rate for tests/CI (no network). `as_of` pins the session date.
- `current_policy_rate() -> float` — returns the live DFR (cached). Order: `dfr_override` → ECB Data Portal → FRED → `DFR_FALLBACK` (2.00) with a warning. Never raises (always returns a usable anchor).
- `estr_spot() -> float | None` — best-effort live €STR fixing; informational/logged only; None on failure. Never raises.
- `forward_curve_available() -> bool` — returns `False`. This is the explicit, documented "best-effort check whether a free source beats spot" — it does not, so we spot-anchor.
- `estimation_basis` (class attr str) — `"spot-anchored — forward odds unavailable"`.
- `fetch(symbols) -> list[ContractPrice]` — prices EVERY requested symbol flat at `100 - current_policy_rate()` (→ implied rate == DFR for every month → decompose yields ~100% Hold). Uses `estr_symbol_to_month` for `contract_month`.

- [ ] **Step 1: Write the failing tests**

```python
# append to tests/test_ecb_estr_source.py
from src.fetchers.ecb_estr_source import EcbEstrFetcher


def test_fetcher_dfr_override_skips_network():
    # dfr_override must short-circuit — http_get that explodes proves no network.
    def boom(url: str) -> str:  # pragma: no cover - must not be called
        raise AssertionError("network must not be hit when dfr_override is set")

    f = EcbEstrFetcher(http_get=boom, dfr_override=2.00)
    assert f.current_policy_rate() == pytest.approx(2.00)


def test_fetch_prices_every_symbol_flat_at_dfr():
    f = EcbEstrFetcher(dfr_override=2.00, as_of=date(2026, 6, 2))
    prices = f.fetch(["ESTR_M26", "ESTR_N26", "ESTR_Z26"])
    assert [p.symbol for p in prices] == ["ESTR_M26", "ESTR_N26", "ESTR_Z26"]
    # implied_rate = 100 - price must equal the DFR (2.00) for all → flat curve.
    for p in prices:
        assert (100.0 - p.price) == pytest.approx(2.00)
    assert prices[0].contract_month == date(2026, 6, 1)
    assert prices[2].contract_month == date(2026, 12, 1)
    assert prices[0].as_of == date(2026, 6, 2)


def test_fetch_skips_unparseable_symbols():
    f = EcbEstrFetcher(dfr_override=2.00)
    prices = f.fetch(["ESTR_M26", "NOT_A_SYMBOL"])
    assert [p.symbol for p in prices] == ["ESTR_M26"]


def test_estimation_basis_is_spot_anchored():
    assert EcbEstrFetcher.estimation_basis == "spot-anchored — forward odds unavailable"
    assert EcbEstrFetcher(dfr_override=2.0).forward_curve_available() is False


def test_current_policy_rate_uses_ecb_portal_then_caches():
    calls = {"n": 0}

    def fake_get(url: str) -> str:
        calls["n"] += 1
        if "data-api.ecb.europa.eu" in url:
            return "KEY,TIME_PERIOD,OBS_VALUE\nx,2026-06-01,1.75\n"
        raise AssertionError(f"unexpected url {url}")

    f = EcbEstrFetcher(http_get=fake_get)
    assert f.current_policy_rate() == pytest.approx(1.75)
    assert f.current_policy_rate() == pytest.approx(1.75)  # cached
    assert calls["n"] == 1  # only one network call


def test_current_policy_rate_falls_back_to_fred_then_default():
    def only_fred(url: str) -> str:
        if "fred.stlouisfed.org" in url:
            return "observation_date,ECBDFR\n2026-06-01,2.25\n"
        raise RuntimeError("ECB portal down")

    assert EcbEstrFetcher(http_get=only_fred).current_policy_rate() == pytest.approx(2.25)

    def all_down(url: str) -> str:
        raise RuntimeError("everything down")

    # Never raises — documented DFR_FALLBACK keeps the pipeline alive.
    assert EcbEstrFetcher(http_get=all_down).current_policy_rate() == pytest.approx(
        EcbEstrFetcher.DFR_FALLBACK
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q`
Expected: FAIL (`ImportError: cannot import name 'EcbEstrFetcher'`).

- [ ] **Step 3: Append the class to `src/fetchers/ecb_estr_source.py`**

Add these imports to the TOP of the file (merge with existing imports):

```python
import logging
from typing import Callable, ClassVar

from .base import BaseFetcher, ContractPrice
```

Add the module-level constants + class (after the helper functions):

```python
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

        estr = self.estr_spot()
        if estr is not None:
            logger.info("EUR STR spot fixing: %.3f%% (DFR anchor: %.3f%%)", estr, rate)

        self._cached_rate = rate
        return rate

    def estr_spot(self) -> float | None:
        """Best-effort €STR fixing (informational). None on any failure."""
        rate = self._fetch_rate(_ESTR_URL, parse_ecb_portal_csv_latest, "ECB portal STR")
        if rate is None:
            rate = self._fetch_rate(_FRED_ESTR_URL, parse_fred_csv_latest, "FRED STR")
        return rate

    def _fetch_rate(
        self, url: str, parser: Callable[[str], float], label: str
    ) -> float | None:
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q`
Expected: PASS (all Task-1 + Task-2 tests).

- [ ] **Step 5: Format + lint**

Run: `.venv/bin/black src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py && .venv/bin/ruff check src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py`
Expected: ruff "All checks passed!".

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/ecb_estr_source.py tests/test_ecb_estr_source.py
git commit -m "feat(ecb): EcbEstrFetcher — free spot-anchored DFR contracts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire `build_fetcher` + argparse `estr` source

**Files:**
- Modify: `src/main.py` (lines ~77-88 `build_fetcher`; ~174 argparse `--source`)
- Test: `tests/test_ecb_estr_source.py` (build_fetcher routing)

- [ ] **Step 1: Write the failing tests**

```python
# append to tests/test_ecb_estr_source.py
from src.main import build_fetcher


def test_build_fetcher_routes_estr_ecb_to_estr_fetcher():
    f = build_fetcher("estr", "ecb")
    assert isinstance(f, EcbEstrFetcher)


def test_build_fetcher_estr_fed_rejected():
    with pytest.raises(ValueError):
        build_fetcher("estr", "fed")


def test_build_fetcher_yfinance_ecb_redirects_to_estr():
    # The old NotImplementedError is replaced with a clear redirect message.
    with pytest.raises(NotImplementedError) as exc:
        build_fetcher("yfinance", "ecb")
    assert "estr" in str(exc.value).lower()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q -k build_fetcher`
Expected: FAIL (`build_fetcher("estr", ...)` raises `ValueError: Unknown source: estr`).

- [ ] **Step 3: Edit `build_fetcher` in `src/main.py`**

Replace the whole `build_fetcher` function body with:

```python
def build_fetcher(source: str, bank: str) -> PriceFetcher:
    if source == "mock":
        return EcbMockFetcher() if bank == "ecb" else MockFetcher()
    if source == "estr":
        if bank != "ecb":
            raise ValueError("source 'estr' is ECB-only (it tracks the ECB DFR/STR).")
        from .fetchers.ecb_estr_source import EcbEstrFetcher

        return EcbEstrFetcher()
    if source == "yfinance":
        if bank == "ecb":
            raise NotImplementedError(
                "No FREE forward-implied source exists for the ECB. Use "
                "--source estr for the spot-anchored estimate "
                "(DFR + STR spot, forward odds unavailable)."
            )
        from .fetchers.yfinance_source import YFinanceFetcher

        return YFinanceFetcher()
    raise ValueError(f"Unknown source: {source}. Valid: mock, yfinance, estr")
```

Then add `estr` to the argparse choices (the `--source` argument):

```python
    parser.add_argument("--source", choices=["mock", "yfinance", "estr"], default="mock")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_ecb_estr_source.py -q`
Expected: PASS (all).

- [ ] **Step 5: Format + lint**

Run: `.venv/bin/black src/main.py && .venv/bin/ruff check src/main.py`
Expected: ruff "All checks passed!".

- [ ] **Step 6: Commit**

```bash
git add src/main.py tests/test_ecb_estr_source.py
git commit -m "feat(ecb): wire estr source into build_fetcher + argparse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Surface the basis — CLI print, real ECB anchor, JSON payload

**Files:**
- Modify: `src/json_writer.py` (add `estimation_basis` param to `write_snapshot_files` + payload)
- Modify: `src/main.py` (basis resolver, ECB real-DFR anchor, print, thread into snapshot write)
- Test: `tests/test_json_writer.py`

- [ ] **Step 1: Write the failing test (json_writer)**

```python
# append to tests/test_json_writer.py
import json as _json

from src.json_writer import write_snapshot_files


def test_snapshot_payload_includes_estimation_basis(tmp_path):
    from dataclasses import dataclass
    from datetime import date

    @dataclass
    class Row:
        meeting_date: date
        outcome_label: str
        outcome_delta_bps: int
        probability: float
        post_meeting_rate: float

    rows = [Row(date(2026, 6, 11), "Hold", 0, 1.0, 2.0)]
    latest, _hist = write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="ECB",
        probabilities=rows,
        estimation_basis="spot-anchored — forward odds unavailable",
    )
    payload = _json.loads(latest.read_text())
    assert payload["estimation_basis"] == "spot-anchored — forward odds unavailable"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_json_writer.py -q -k estimation_basis`
Expected: FAIL (`TypeError: unexpected keyword 'estimation_basis'`).

- [ ] **Step 3: Add `estimation_basis` to `write_snapshot_files`**

In `src/json_writer.py`, extend the signature (keep the existing `methodology_version` default exactly as-is — that is Phase 3's fix, not this one):

```python
def write_snapshot_files(
    snapshot_dir: Path,
    bank_code: str,
    probabilities: Iterable,
    snapshot_at: datetime | None = None,
    methodology_version: str = "1.0.0",
    estimation_basis: str | None = None,
) -> tuple[Path, Path]:
```

And in the `payload` dict, add the field right after `methodology_version`:

```python
    payload = {
        "bank_code": bank_code.upper(),
        "snapshot_at": snapshot_at.isoformat(),
        "methodology_version": methodology_version,
        "estimation_basis": estimation_basis,
        "rows": rows,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_json_writer.py -q`
Expected: PASS (existing + new).

- [ ] **Step 5: Add the basis resolver + ECB anchor + print in `src/main.py`**

Add a helper above `main()`:

```python
def estimation_basis_for(fetcher: PriceFetcher, bank: str, source: str) -> str:
    """Honest one-line label for how this run's numbers were derived."""
    explicit = getattr(fetcher, "estimation_basis", None)
    if explicit:
        return str(explicit)
    if source == "mock":
        return "mock (synthetic test data — not market-derived)"
    if bank == "fed":
        return "forward-implied (Fed Funds futures via yfinance)"
    return "unspecified"
```

In `main()`, right after `fetcher = build_fetcher(args.source, args.bank)`, prefer the live ECB DFR as the anchor when the user did not pin `--current-rate`, and compute the basis:

```python
    fetcher = build_fetcher(args.source, args.bank)
    # ECB spot fetcher knows the live DFR — use it as the anchor unless pinned.
    if args.current_rate is None and hasattr(fetcher, "current_policy_rate"):
        current_rate = fetcher.current_policy_rate()

    basis = estimation_basis_for(fetcher, args.bank, args.source)
```

After `print_probabilities(results)`, print the basis banner:

```python
    print(f"\nEstimation basis: {basis}")
```

Thread the basis into the snapshot write (the `write_snapshot_files(...)` call):

```python
        latest, history = write_snapshot_files(
            snapshot_dir=args.json_snapshot_dir,
            bank_code=args.bank.upper(),
            probabilities=results,
            snapshot_at=started_at,
            methodology_version=METHODOLOGY_VERSION,
            estimation_basis=basis,
        )
```

- [ ] **Step 6: Run the full suite + format/lint**

Run: `.venv/bin/python -m pytest -q && .venv/bin/black src/main.py src/json_writer.py tests/test_json_writer.py && .venv/bin/ruff check src/main.py src/json_writer.py tests/test_json_writer.py`
Expected: all tests PASS; ruff "All checks passed!".

- [ ] **Step 7: Commit**

```bash
git add src/main.py src/json_writer.py tests/test_json_writer.py
git commit -m "feat(ecb): surface estimation basis in CLI + JSON snapshot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Methodology §6 note + §11 changelog + version bump

**Files:**
- Modify: `docs/METHODOLOGY.md` (§6 + §11)
- Modify: `src/main.py` (`METHODOLOGY_VERSION`)

- [ ] **Step 1: Bump the version in `src/main.py`**

```python
METHODOLOGY_VERSION = "1.2.0"
```

- [ ] **Step 2: Append a spot-anchored note to §6 in `docs/METHODOLOGY.md`**

After the existing §6 paragraph (the one ending "...substituting €STR OIS rates for Fed Funds Futures."), add:

```markdown
**Free-data limitation (spot-anchored mode).** Forward-implied €STR (OIS) and
Euribor-futures curves are not available from any free, redistributable source —
they are paid (Barchart / ICE / BlueGamma) or scrape-only, both of which we rule
out. What is free and authoritative is the *spot* picture: the current DFR and
the €STR fixing, from the ECB Data Portal (`data-api.ecb.europa.eu`, no auth)
with a FRED CSV fallback. When no free forward curve is available, RateRadar
therefore runs the ECB in **spot-anchored** mode: every upcoming meeting is
anchored at the current DFR (no change priced forward) and the output is
**explicitly labeled "spot-anchored — forward odds unavailable"** in the API and
UI. This is deliberately low-information — ECB probability history will be
near-flat — and is preferred over fabricating a forward curve or paying for data.
```

- [ ] **Step 3: Add a §11 changelog entry (newest first, above the v1.1.0 entry)**

```markdown
- **v1.2.0** — ECB switched to honest **spot-anchored** mode (§6). With no free
  forward-implied €STR/Euribor source, the ECB pipeline anchors every meeting at
  the current DFR (fetched live from the ECB Data Portal, FRED fallback) and
  labels the output "spot-anchored — forward odds unavailable" in the API
  payload (`estimation_basis`) and UI. Fed is unaffected (still forward-implied).
```

- [ ] **Step 4: Verify the version is consistent**

Run: `.venv/bin/python -c "from src.main import METHODOLOGY_VERSION; print(METHODOLOGY_VERSION)" && grep -n "v1.2.0" ../../docs/METHODOLOGY.md`
Expected: prints `1.2.0` and the changelog line.

- [ ] **Step 5: Commit**

```bash
git add ../../docs/METHODOLOGY.md src/main.py
git commit -m "docs(methodology): ECB spot-anchored mode section 6 + 11, bump v1.2.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Full verify — live run + green suite + clean lint

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `.venv/bin/python -m pytest -q`
Expected: all PASS (76 prior + new ECB/json tests).

- [ ] **Step 2: black + ruff on every file touched this phase**

Run: `.venv/bin/black --check src/fetchers/ecb_estr_source.py src/main.py src/json_writer.py tests/test_ecb_estr_source.py tests/test_json_writer.py && .venv/bin/ruff check src/fetchers/ecb_estr_source.py src/main.py src/json_writer.py tests/test_ecb_estr_source.py tests/test_json_writer.py`
Expected: black "would reformat 0 files"; ruff "All checks passed!".

- [ ] **Step 3: Live spot-anchored CLI run (the Phase-2 VERIFY)**

Run: `.venv/bin/python -m src.main --bank ecb --year 2026 --source estr`
Expected: prints a per-meeting distribution that is overwhelmingly **Hold** (spot-anchored, flat), and a final line `Estimation basis: spot-anchored — forward odds unavailable`. The current rate logged should be the live DFR (≈ 2.00%); if the network is unreachable it falls back to 2.00 with a warning and STILL prints the labeled distribution. Per-meeting probabilities sum to 1.

> If the live ECB Data Portal / FRED endpoints are unreachable in this environment, that is acceptable: the run must still succeed via the documented fallback and print the spot-anchored label. Record the observed current-rate source (live vs fallback) in the verify note.

- [ ] **Step 4: Live JSON snapshot carries the basis**

Run: `.venv/bin/python -m src.main --bank ecb --year 2026 --source estr --json-snapshot-dir /tmp/rr-ecb-verify && grep -m1 estimation_basis /tmp/rr-ecb-verify/ecb/latest.json`
Expected: `"estimation_basis": "spot-anchored — forward odds unavailable",`

- [ ] **Step 5: FED still works (no regression)**

Run: `.venv/bin/python -m src.main --bank fed --year 2026 --source mock`
Expected: prints FED distribution + `Estimation basis: mock (synthetic test data — not market-derived)`. (mock is fine here — we only assert no crash + basis prints.)

---

## Self-review notes (spec coverage)

- New `EcbEstrFetcher` via ECB Data Portal (DFR + €STR), FRED fallback — Tasks 1-2.
- Best-effort free-forward check (`forward_curve_available()` → False, documented) — Task 2.
- Spot-anchored, explicitly labeled in API output (JSON `estimation_basis`) + METHODOLOGY (§6 + §11 + version) — Tasks 4-5.
- Wired into `build_fetcher`; old `yfinance`+`ecb` NotImplementedError replaced with an `estr` redirect — Task 3.
- `ecb_mock` kept for tests (untouched) — existing `test_ecb_fetcher.py` still green.
- Verify: new tests green, live labeled distribution, full suite green, black+ruff clean — Task 6.
- `probability_calc.py` untouched (stays pure); `json_writer.py:42` methodology default left for Phase 3.
