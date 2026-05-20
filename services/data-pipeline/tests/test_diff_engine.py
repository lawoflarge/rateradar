"""Tests for diff_engine — derived content from snapshot history."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
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


def _make_snapshot(bank: str, snapshot_at: str, rows: list[dict]):
    from src.diff_engine import Snapshot, SnapshotRow

    return Snapshot(
        bank_code=bank,
        snapshot_at=snapshot_at,
        rows=[
            SnapshotRow(
                meeting_date=r["meeting_date"],
                outcome_label=r["outcome_label"],
                outcome_delta_bps=r["outcome_delta_bps"],
                probability=r["probability"],
                post_meeting_rate=r.get("post_meeting_rate", 0.0),
            )
            for r in rows
        ],
    )


def _make_series_point(snapshot_at: str, delta_bps: int, prob: float):
    from src.diff_engine import SeriesPoint

    label = "Hold" if delta_bps == 0 else f"{delta_bps:+d}bp"
    return SeriesPoint(
        snapshot_at=snapshot_at,
        outcome_label=label,
        delta_bps=delta_bps,
        probability=prob,
    )


def test_compute_brief_picks_largest_abs_shift_as_headline():
    from src.diff_engine import compute_brief

    now = datetime(2026, 5, 20, 23, 0, tzinfo=UTC)
    prior = (now - timedelta(hours=24)).isoformat()

    fed_snap = _make_snapshot(
        "FED",
        now.isoformat(),
        [
            {"meeting_date": "2026-06-17", "outcome_label": "Hold",
             "outcome_delta_bps": 0, "probability": 0.55},
            {"meeting_date": "2026-06-17", "outcome_label": "-25bp",
             "outcome_delta_bps": -25, "probability": 0.45},
        ],
    )
    fed_series = {
        "2026-06-17": [
            _make_series_point(prior, 0, 0.45),    # delta = +10pp on Hold
            _make_series_point(prior, -25, 0.55),  # delta = -10pp on -25bp
        ]
    }

    ecb_snap = _make_snapshot("ECB", now.isoformat(), [])
    ecb_series: dict = {}

    brief = compute_brief(fed_snap, ecb_snap, fed_series, ecb_series, now=now)

    assert brief["date"] == "2026-05-20"
    assert brief["headline"] is not None
    assert abs(brief["headline"]["delta_pp"]) == pytest.approx(10.0, abs=0.1)
    assert brief["headline"]["meeting_id"] == "FED-2026-06-17"
    assert len(brief["top_shifts"]) == 2
    assert brief["calendar_context"] == []  # populated in PR-3


def test_compute_brief_empty_when_no_prior_history():
    from src.diff_engine import compute_brief

    now = datetime(2026, 5, 20, 23, 0, tzinfo=UTC)
    fed_snap = _make_snapshot(
        "FED",
        now.isoformat(),
        [
            {"meeting_date": "2026-06-17", "outcome_label": "Hold",
             "outcome_delta_bps": 0, "probability": 0.55}
        ],
    )
    ecb_snap = _make_snapshot("ECB", now.isoformat(), [])
    brief = compute_brief(fed_snap, ecb_snap, {}, {}, now=now)

    assert brief["headline"] is None
    assert brief["top_shifts"] == []


def test_compute_brief_ignores_series_points_inside_18h_window():
    """Prior must be at least 18h ago to count as 'yesterday's number'."""
    from src.diff_engine import compute_brief

    now = datetime(2026, 5, 20, 23, 0, tzinfo=UTC)
    too_recent = (now - timedelta(hours=6)).isoformat()  # 6h ago — too recent

    fed_snap = _make_snapshot(
        "FED",
        now.isoformat(),
        [
            {"meeting_date": "2026-06-17", "outcome_label": "Hold",
             "outcome_delta_bps": 0, "probability": 0.55}
        ],
    )
    fed_series = {"2026-06-17": [_make_series_point(too_recent, 0, 0.45)]}
    ecb_snap = _make_snapshot("ECB", now.isoformat(), [])

    brief = compute_brief(fed_snap, ecb_snap, fed_series, {}, now=now)
    assert brief["headline"] is None


def test_compute_meeting_timeline_emits_full_series_and_top3_shifts():
    from src.diff_engine import compute_meeting_timeline

    bank = "FED"
    meeting_date = "2026-06-17"
    series = [
        _make_series_point("2026-05-15T22:00:00+00:00", 0, 0.30),
        _make_series_point("2026-05-16T22:00:00+00:00", 0, 0.30),
        _make_series_point("2026-05-17T22:00:00+00:00", 0, 0.40),  # +10pp jump
        _make_series_point("2026-05-18T22:00:00+00:00", 0, 0.41),
        _make_series_point("2026-05-19T22:00:00+00:00", 0, 0.55),  # +14pp jump
        _make_series_point("2026-05-15T22:00:00+00:00", -25, 0.70),
        _make_series_point("2026-05-19T22:00:00+00:00", -25, 0.45),  # -25pp drop
    ]
    timeline = compute_meeting_timeline(bank, meeting_date, series)

    assert timeline["meeting_id"] == "FED-2026-06-17"
    assert timeline["bank_code"] == "FED"
    assert timeline["meeting_date"] == "2026-06-17"
    # All series points pass through, grouped by outcome
    assert set(timeline["series"].keys()) == {0, -25}
    assert len(timeline["series"][0]) == 5
    # Top 3 shifts ordered by absolute size
    top = timeline["top_shifts"]
    assert len(top) == 3
    assert abs(top[0]["delta_pp"]) >= abs(top[1]["delta_pp"]) >= abs(top[2]["delta_pp"])


def test_compute_meeting_timeline_empty_series_returns_empty():
    from src.diff_engine import compute_meeting_timeline

    out = compute_meeting_timeline("FED", "2026-06-17", [])
    assert out["series"] == {}
    assert out["top_shifts"] == []
