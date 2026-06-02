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
