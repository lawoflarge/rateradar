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


def test_compute_scoreboard_no_actuals_returns_zero_stats():
    from src.diff_engine import compute_scoreboard

    out = compute_scoreboard(actuals=[], fed_series={}, ecb_series={})
    assert out["total_meetings"] == 0
    assert out["overall_hit_rate"] is None
    assert out["per_bank"] == {"FED": None, "ECB": None}
    assert out["biggest_misses"] == []
    assert out["longest_streak"] == 0


def test_compute_scoreboard_one_meeting_market_was_right():
    from src.diff_engine import Actual, compute_scoreboard

    # Day-before market: 70% Hold (which actually happened).
    fed_series = {
        "2026-05-01": [
            _make_series_point("2026-04-30T22:00:00+00:00", 0, 0.70),
            _make_series_point("2026-04-30T22:00:00+00:00", -25, 0.30),
        ]
    }
    actuals = [
        Actual(
            meeting_id="FED-2026-05-01",
            decision="hold",
            decision_bps=0,
            effective_date="2026-05-01",
        )
    ]
    out = compute_scoreboard(actuals=actuals, fed_series=fed_series, ecb_series={})
    assert out["total_meetings"] == 1
    assert out["overall_hit_rate"] == pytest.approx(1.0)
    assert out["per_bank"]["FED"] == pytest.approx(1.0)
    assert out["longest_streak"] == 1


def test_compute_scoreboard_one_meeting_market_was_wrong_records_miss():
    from src.diff_engine import Actual, compute_scoreboard

    # Day-before market: 70% Hold. Actual: -25bp cut. Miss.
    fed_series = {
        "2026-05-01": [
            _make_series_point("2026-04-30T22:00:00+00:00", 0, 0.70),
            _make_series_point("2026-04-30T22:00:00+00:00", -25, 0.30),
        ]
    }
    actuals = [
        Actual(
            meeting_id="FED-2026-05-01",
            decision="cut_25",
            decision_bps=-25,
            effective_date="2026-05-01",
        )
    ]
    out = compute_scoreboard(actuals=actuals, fed_series=fed_series, ecb_series={})
    assert out["overall_hit_rate"] == pytest.approx(0.0)
    assert len(out["biggest_misses"]) == 1
    miss = out["biggest_misses"][0]
    assert miss["meeting_id"] == "FED-2026-05-01"
    assert miss["actual_decision_bps"] == -25
    assert miss["day_before_top_outcome_delta_bps"] == 0
    assert miss["day_before_top_probability"] == pytest.approx(0.70)


def test_compute_scoreboard_sorts_biggest_misses_by_confidence():
    """Misses are ranked by how confident the market was in the wrong outcome."""
    from src.diff_engine import Actual, compute_scoreboard

    fed_series = {
        # Meeting A: market 90% Hold, actual was -25bp cut. High-confidence miss.
        "2026-05-01": [
            _make_series_point("2026-04-30T22:00:00+00:00", 0, 0.90),
            _make_series_point("2026-04-30T22:00:00+00:00", -25, 0.10),
        ],
        # Meeting B: market 55% Hold, actual was -25bp cut. Lower-confidence miss.
        "2026-06-01": [
            _make_series_point("2026-05-31T22:00:00+00:00", 0, 0.55),
            _make_series_point("2026-05-31T22:00:00+00:00", -25, 0.45),
        ],
    }
    actuals = [
        Actual(
            meeting_id="FED-2026-05-01",
            decision="cut_25",
            decision_bps=-25,
            effective_date="2026-05-01",
        ),
        Actual(
            meeting_id="FED-2026-06-01",
            decision="cut_25",
            decision_bps=-25,
            effective_date="2026-06-01",
        ),
    ]
    out = compute_scoreboard(actuals=actuals, fed_series=fed_series, ecb_series={})
    assert out["total_meetings"] == 2
    assert len(out["biggest_misses"]) == 2
    # High-confidence miss (0.90) must come first.
    assert out["biggest_misses"][0]["meeting_id"] == "FED-2026-05-01"
    assert out["biggest_misses"][0]["day_before_top_probability"] == pytest.approx(0.90)
    assert out["biggest_misses"][1]["meeting_id"] == "FED-2026-06-01"
    assert out["biggest_misses"][1]["day_before_top_probability"] == pytest.approx(0.55)


def test_render_embed_svg_contains_expected_substrings():
    from src.diff_engine import render_embed_svg

    snap = _make_snapshot(
        "FED",
        "2026-05-20T22:00:00+00:00",
        [
            {"meeting_date": "2026-06-17", "outcome_label": "Hold",
             "outcome_delta_bps": 0, "probability": 0.55},
            {"meeting_date": "2026-06-17", "outcome_label": "-25bp",
             "outcome_delta_bps": -25, "probability": 0.45},
        ],
    )
    series = {
        "2026-06-17": [
            _make_series_point("2026-04-20T22:00:00+00:00", 0, 0.30),
            _make_series_point("2026-05-10T22:00:00+00:00", 0, 0.45),
            _make_series_point("2026-05-19T22:00:00+00:00", 0, 0.50),
            _make_series_point("2026-05-20T22:00:00+00:00", 0, 0.55),
        ]
    }

    svg = render_embed_svg("FED", "2026-06-17", snap, series)
    assert svg.startswith("<?xml") or svg.startswith("<svg")
    assert "viewBox" in svg
    assert "600" in svg
    assert "200" in svg
    assert "FED" in svg
    assert "55%" in svg or "55" in svg  # current top probability
    assert "Powered by RateRadar" in svg  # attribution required
    assert len(svg.encode("utf-8")) < 5 * 1024  # under 5KB target


def test_render_embed_svg_meeting_not_in_snapshot_returns_minimal():
    from src.diff_engine import render_embed_svg

    snap = _make_snapshot("FED", "2026-05-20T22:00:00+00:00", [])
    svg = render_embed_svg("FED", "2026-06-17", snap, {})
    assert "no data" in svg.lower() or "RateRadar" in svg


def test_run_writes_all_expected_files(tmp_path: Path):
    """Full end-to-end: feed the engine real snapshot data, assert it writes
    every output file the consumers need."""
    from src.diff_engine import run

    # Layout the inputs.
    snapshots = tmp_path / "snapshots"
    for bank in ("fed", "ecb"):
        (snapshots / bank).mkdir(parents=True)
    (snapshots / "fed" / "latest.json").write_text(
        json.dumps(
            {
                "bank_code": "FED",
                "snapshot_at": "2026-05-20T22:00:00+00:00",
                "methodology_version": "1.0.0",
                "rows": [
                    {"meeting_date": "2026-06-17", "outcome_label": "Hold",
                     "outcome_delta_bps": 0, "probability": 0.55,
                     "post_meeting_rate": 4.375}
                ],
            }
        ),
        encoding="utf-8",
    )
    (snapshots / "fed" / "series.json").write_text(
        json.dumps(
            {
                "bank_code": "FED",
                "series": {
                    "2026-06-17": [
                        {"snapshot_at": "2026-05-19T04:00:00+00:00",
                         "outcome_label": "Hold", "delta_bps": 0,
                         "probability": 0.45, "post_meeting_rate": 4.375},
                        {"snapshot_at": "2026-05-20T22:00:00+00:00",
                         "outcome_label": "Hold", "delta_bps": 0,
                         "probability": 0.55, "post_meeting_rate": 4.375},
                    ]
                },
            }
        ),
        encoding="utf-8",
    )
    (snapshots / "ecb" / "latest.json").write_text(
        json.dumps(
            {
                "bank_code": "ECB", "snapshot_at": "2026-05-20T22:00:00+00:00",
                "methodology_version": "1.0.0", "rows": []
            }
        ),
        encoding="utf-8",
    )
    (snapshots / "ecb" / "series.json").write_text(
        json.dumps({"bank_code": "ECB", "series": {}}), encoding="utf-8"
    )

    actuals_path = tmp_path / "actuals.json"
    actuals_path.write_text("[]", encoding="utf-8")

    content_dir = tmp_path / "content"
    now_iso = "2026-05-20T23:00:00+00:00"

    run(
        snapshots_dir=snapshots,
        actuals_path=actuals_path,
        content_dir=content_dir,
        now_iso=now_iso,
    )

    # Brief
    assert (content_dir / "briefs" / "2026-05-20.json").exists()
    brief = json.loads((content_dir / "briefs" / "2026-05-20.json").read_text(encoding="utf-8"))
    assert brief["date"] == "2026-05-20"
    # Brief index
    assert (content_dir / "briefs" / "index.json").exists()
    index = json.loads((content_dir / "briefs" / "index.json").read_text(encoding="utf-8"))
    assert any(b["date"] == "2026-05-20" for b in index["briefs"])
    # Per-meeting timeline
    timeline_path = content_dir / "meetings" / "FED-2026-06-17" / "timeline.json"
    assert timeline_path.exists()
    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    assert timeline["meeting_id"] == "FED-2026-06-17"
    # Scoreboard
    assert (content_dir / "scoreboard.json").exists()
    # Embed SVG
    embed_path = content_dir / "embed" / "FED-2026-06-17.svg"
    assert embed_path.exists()
    assert "Powered by RateRadar" in embed_path.read_text(encoding="utf-8")
