"""Tests for the FED --current-rate requirement (no stale 4.375 default)."""

from __future__ import annotations

import pytest

from src.main import resolve_current_rate


def test_fed_current_rate_from_cli_arg():
    assert resolve_current_rate(bank="fed", cli_value=3.625, env=None) == pytest.approx(3.625)


def test_fed_current_rate_from_env_when_cli_absent(monkeypatch):
    assert resolve_current_rate(bank="fed", cli_value=None, env="3.625") == pytest.approx(3.625)


def test_fed_current_rate_required_when_missing():
    # No CLI, no env -> hard error. The old silent 4.375 default is gone.
    with pytest.raises(SystemExit):
        resolve_current_rate(bank="fed", cli_value=None, env=None)


def test_fed_has_no_stale_default():
    # Guard: the 4.375 literal must not be the FED fallback anymore.
    from src import main

    assert main.DEFAULT_RATES.get("fed") != 4.375


def test_ecb_default_still_applies():
    assert resolve_current_rate(bank="ecb", cli_value=None, env=None) == pytest.approx(2.00)
