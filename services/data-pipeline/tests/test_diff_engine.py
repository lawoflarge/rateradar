"""Tests for diff_engine — derived content from snapshot history."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest


def test_module_imports():
    """Smoke test: the module loads."""
    from src import diff_engine  # noqa: F401


def test_load_snapshot_missing_returns_none(tmp_path: Path):
    from src.diff_engine import load_snapshot

    assert load_snapshot(tmp_path, "FED") is None


def test_load_snapshot_parses_real_shape(tmp_path: Path):
    from src.diff_engine import load_snapshot

    fed_dir = tmp_path / "fed"
    fed_dir.mkdir()
    (fed_dir / "latest.json").write_text(
        json.dumps(
            {
                "bank_code": "FED",
                "snapshot_at": "2026-05-19T23:12:32+00:00",
                "methodology_version": "1.0.0",
                "rows": [
                    {
                        "meeting_date": "2026-06-17",
                        "outcome_label": "Hold",
                        "outcome_delta_bps": 0,
                        "probability": 0.446,
                        "post_meeting_rate": 4.375,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    snap = load_snapshot(tmp_path, "FED")
    assert snap is not None
    assert snap.bank_code == "FED"
    assert snap.snapshot_at == "2026-05-19T23:12:32+00:00"
    assert len(snap.rows) == 1
    assert snap.rows[0].meeting_date == "2026-06-17"
    assert snap.rows[0].outcome_delta_bps == 0
    assert snap.rows[0].probability == pytest.approx(0.446)


def test_load_actuals_empty(tmp_path: Path):
    from src.diff_engine import load_actuals

    p = tmp_path / "actuals.json"
    p.write_text("[]", encoding="utf-8")
    assert load_actuals(p) == []


def test_load_actuals_parses_row(tmp_path: Path):
    from src.diff_engine import load_actuals

    p = tmp_path / "actuals.json"
    p.write_text(
        json.dumps(
            [
                {
                    "meeting_id": "FED-2026-06-17",
                    "decision": "cut_25",
                    "decision_bps": -25,
                    "effective_date": "2026-06-17",
                }
            ]
        ),
        encoding="utf-8",
    )
    actuals = load_actuals(p)
    assert len(actuals) == 1
    assert actuals[0].meeting_id == "FED-2026-06-17"
    assert actuals[0].decision_bps == -25
    assert actuals[0].effective_date == "2026-06-17"
