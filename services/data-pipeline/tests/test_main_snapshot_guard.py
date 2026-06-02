"""Keep-last-good: main must NOT write a snapshot when the fetch returned nothing."""

from __future__ import annotations

import sys
from datetime import date

import src.main as main_mod
from src.fed_fetcher import MeetingProbability
from src.main import has_publishable_rows


def test_has_publishable_rows():
    assert has_publishable_rows([]) is False
    assert has_publishable_rows([object()]) is True


def test_main_skips_snapshot_write_on_empty_results(tmp_path, monkeypatch, capsys):
    # Simulate a rate-limited fetch: run_fed_fetch yields zero rows.
    monkeypatch.setattr(main_mod, "run_fed_fetch", lambda **kwargs: [])
    monkeypatch.setattr(
        sys,
        "argv",
        ["main", "--bank", "fed", "--current-rate", "3.625", "--json-snapshot-dir", str(tmp_path)],
    )
    rc = main_mod.main()
    assert rc == 0  # rate-limited run stays green (transient, expected)
    assert not (tmp_path / "fed" / "latest.json").exists()  # last-good preserved
    assert "skipped" in capsys.readouterr().err.lower()


def test_main_writes_snapshot_on_nonempty_results(tmp_path, monkeypatch):
    rows = [MeetingProbability(date(2026, 6, 17), "Hold", 0, 0.9, 3.625)]
    monkeypatch.setattr(main_mod, "run_fed_fetch", lambda **kwargs: rows)
    monkeypatch.setattr(
        sys,
        "argv",
        ["main", "--bank", "fed", "--current-rate", "3.625", "--json-snapshot-dir", str(tmp_path)],
    )
    rc = main_mod.main()
    assert rc == 0
    assert (tmp_path / "fed" / "latest.json").exists()  # real data IS written
