"""diff_engine — compute derived content from snapshot history.

Reads (relative to a snapshots root):
  <root>/fed/latest.json
  <root>/fed/series.json
  <root>/ecb/latest.json
  <root>/ecb/series.json

Plus a manual file:
  services/data-pipeline/actuals.json

Writes (relative to a content root):
  <content>/briefs/<YYYY-MM-DD>.json
  <content>/briefs/index.json
  <content>/meetings/<bank>-<date>/timeline.json
  <content>/scoreboard.json
  <content>/embed/<bank>-<date>.svg

No network I/O. Pure data transformation. Designed to run inside the existing
GitHub Actions cron after the snapshot job lands, producing one atomic commit
that contains both the snapshots and the derived content.

actuals.json schema (one object per past meeting, manually appended by Levin):
  {
    "meeting_id": "FED-2026-06-17",     # synthetic id: <BANK>-<YYYY-MM-DD>
    "decision": "cut_25",                # human label
    "decision_bps": -25,                  # canonical: -50, -25, 0, 25, 50
    "effective_date": "2026-06-17"
  }
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SnapshotRow:
    meeting_date: str
    outcome_label: str
    outcome_delta_bps: int
    probability: float
    post_meeting_rate: float


@dataclass(frozen=True)
class Snapshot:
    bank_code: str
    snapshot_at: str
    rows: list[SnapshotRow]


@dataclass(frozen=True)
class SeriesPoint:
    snapshot_at: str
    outcome_label: str
    delta_bps: int
    probability: float


@dataclass(frozen=True)
class Actual:
    meeting_id: str
    decision: str
    decision_bps: int
    effective_date: str


def load_snapshot(snapshots_dir: Path, bank: str) -> Snapshot | None:
    """Read <snapshots_dir>/<bank>/latest.json. Returns None if missing."""
    path = snapshots_dir / bank.lower() / "latest.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = [
        SnapshotRow(
            meeting_date=r["meeting_date"],
            outcome_label=r["outcome_label"],
            outcome_delta_bps=r["outcome_delta_bps"],
            probability=float(r["probability"]),
            post_meeting_rate=float(r["post_meeting_rate"]),
        )
        for r in data.get("rows", [])
    ]
    return Snapshot(
        bank_code=str(data["bank_code"]).upper(),
        snapshot_at=str(data["snapshot_at"]),
        rows=rows,
    )


def load_series(
    snapshots_dir: Path, bank: str
) -> dict[str, list[SeriesPoint]]:
    """Read <snapshots_dir>/<bank>/series.json. Returns {} if missing."""
    path = snapshots_dir / bank.lower() / "series.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, list[SeriesPoint]] = {}
    for meeting_date, points in (data.get("series") or {}).items():
        out[meeting_date] = [
            SeriesPoint(
                snapshot_at=str(p["snapshot_at"]),
                outcome_label=str(p["outcome_label"]),
                delta_bps=int(p["delta_bps"]),
                probability=float(p["probability"]),
            )
            for p in points
        ]
    return out


def load_actuals(path: Path) -> list[Actual]:
    """Read actuals.json. Returns [] if file missing or empty array.

    Normalises meeting_id so the bank prefix is uppercase, since the canonical
    synthetic id format is <UPPERCASE_BANK>-<YYYY-MM-DD>. This protects against
    a silent join failure if someone appends a row with a lowercase prefix.
    """
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        Actual(
            meeting_id=_normalise_meeting_id(str(row["meeting_id"])),
            decision=str(row["decision"]),
            decision_bps=int(row["decision_bps"]),
            effective_date=str(row["effective_date"]),
        )
        for row in data
    ]


def _normalise_meeting_id(meeting_id: str) -> str:
    """Force the bank prefix to uppercase: 'fed-2026-06-17' -> 'FED-2026-06-17'."""
    bank, _, rest = meeting_id.partition("-")
    return f"{bank.upper()}-{rest}" if rest else meeting_id
