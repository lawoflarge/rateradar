"""Tests for diff_engine — derived content from snapshot history."""

from __future__ import annotations

import json
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


def test_load_series_parses_nested_shape(tmp_path: Path):
    from src.diff_engine import load_series

    fed_dir = tmp_path / "fed"
    fed_dir.mkdir()
    (fed_dir / "series.json").write_text(
        json.dumps(
            {
                "bank_code": "FED",
                "series": {
                    "2026-06-17": [
                        {
                            "snapshot_at": "2026-05-19T22:00:00+00:00",
                            "outcome_label": "Hold",
                            "delta_bps": 0,
                            "probability": 0.45,
                            "post_meeting_rate": 4.375,
                        },
                        {
                            "snapshot_at": "2026-05-20T22:00:00+00:00",
                            "outcome_label": "Hold",
                            "delta_bps": 0,
                            "probability": 0.55,
                            "post_meeting_rate": 4.375,
                        },
                    ]
                },
            }
        ),
        encoding="utf-8",
    )

    series = load_series(tmp_path, "FED")
    assert list(series.keys()) == ["2026-06-17"]
    points = series["2026-06-17"]
    assert len(points) == 2
    assert points[0].snapshot_at == "2026-05-19T22:00:00+00:00"
    assert points[0].delta_bps == 0
    assert points[0].probability == pytest.approx(0.45)
    assert points[1].probability == pytest.approx(0.55)


def test_load_series_missing_returns_empty_dict(tmp_path: Path):
    from src.diff_engine import load_series

    assert load_series(tmp_path, "FED") == {}


def test_load_actuals_normalises_lowercase_bank_prefix(tmp_path: Path):
    from src.diff_engine import load_actuals

    p = tmp_path / "actuals.json"
    p.write_text(
        json.dumps(
            [
                {
                    "meeting_id": "fed-2026-06-17",  # lowercase prefix
                    "decision": "cut_25",
                    "decision_bps": -25,
                    "effective_date": "2026-06-17",
                }
            ]
        ),
        encoding="utf-8",
    )
    actuals = load_actuals(p)
    assert actuals[0].meeting_id == "FED-2026-06-17"  # normalised
