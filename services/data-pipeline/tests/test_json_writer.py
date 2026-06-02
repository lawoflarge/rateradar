"""Tests for the JSON snapshot writer (git-as-DB fallback)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from src.json_writer import write_snapshot_files


@dataclass(frozen=True)
class _Prob:
    meeting_date: date
    outcome_label: str
    outcome_delta_bps: int
    probability: float
    post_meeting_rate: float


def _sample(meeting: date = date(2026, 6, 17)) -> list[_Prob]:
    return [
        _Prob(meeting, "-25bp", -25, 0.12, 4.125),
        _Prob(meeting, "Hold", 0, 0.81, 4.375),
        _Prob(meeting, "+25bp", 25, 0.07, 4.625),
    ]


def test_writes_latest_and_history(tmp_path: Path) -> None:
    snap_at = datetime(2026, 5, 14, 22, 0, 0, tzinfo=UTC)
    latest, history = write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="FED",
        probabilities=_sample(),
        snapshot_at=snap_at,
        methodology_version="1.2.0",
    )

    assert latest == tmp_path / "fed" / "latest.json"
    assert history == tmp_path / "fed" / "history" / "2026-05-14T22-00-00Z.json"
    assert latest.exists()
    assert history.exists()

    payload = json.loads(latest.read_text(encoding="utf-8"))
    assert payload["bank_code"] == "FED"
    assert payload["snapshot_at"] == "2026-05-14T22:00:00+00:00"
    assert len(payload["rows"]) == 3
    assert payload["rows"][1]["outcome_label"] == "Hold"
    assert payload["rows"][1]["probability"] == 0.81


def test_history_is_append_only(tmp_path: Path) -> None:
    """Two runs at different timestamps produce two history files, one latest."""
    write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="FED",
        probabilities=_sample(),
        snapshot_at=datetime(2026, 5, 14, 18, 0, 0, tzinfo=UTC),
        methodology_version="1.2.0",
    )
    write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="FED",
        probabilities=_sample(),
        snapshot_at=datetime(2026, 5, 14, 22, 0, 0, tzinfo=UTC),
        methodology_version="1.2.0",
    )

    history_files = sorted((tmp_path / "fed" / "history").iterdir())
    assert len(history_files) == 2
    assert history_files[0].name == "2026-05-14T18-00-00Z.json"
    assert history_files[1].name == "2026-05-14T22-00-00Z.json"

    latest = json.loads((tmp_path / "fed" / "latest.json").read_text(encoding="utf-8"))
    assert latest["snapshot_at"].endswith("22:00:00+00:00")


def test_methodology_version_recorded(tmp_path: Path) -> None:
    latest, _ = write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="ECB",
        probabilities=_sample(date(2026, 7, 24)),
        snapshot_at=datetime(2026, 5, 14, 18, 0, 0, tzinfo=UTC),
        methodology_version="1.2.3",
    )
    payload = json.loads(latest.read_text(encoding="utf-8"))
    assert payload["methodology_version"] == "1.2.3"
    assert payload["bank_code"] == "ECB"


def test_snapshot_payload_includes_estimation_basis(tmp_path: Path) -> None:
    latest, _hist = write_snapshot_files(
        snapshot_dir=tmp_path,
        bank_code="ECB",
        probabilities=[_Prob(date(2026, 6, 11), "Hold", 0, 1.0, 2.0)],
        methodology_version="1.2.0",
        estimation_basis="spot-anchored — forward odds unavailable",
    )
    payload = json.loads(latest.read_text(encoding="utf-8"))
    assert payload["estimation_basis"] == "spot-anchored — forward odds unavailable"


def test_methodology_version_is_required(tmp_path: Path) -> None:
    with pytest.raises(TypeError):
        write_snapshot_files(
            snapshot_dir=tmp_path,
            bank_code="FED",
            probabilities=[],
        )  # type: ignore[call-arg]
