"""Unit tests for the free ECB spot-anchored fetcher."""

from __future__ import annotations

from datetime import date

import pytest

from src.fetchers.ecb_estr_source import (
    EcbEstrFetcher,
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
