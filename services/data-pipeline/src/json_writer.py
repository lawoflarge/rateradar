"""Snapshot persistence to JSON files (git-backed fallback for Supabase).

Why this exists: the Supabase free tier pauses inactive projects, and when
that happens the pooler answers `FATAL: tenant not found` and the cron's
write step blows up. Writing snapshots to JSON in the repo gives us a
durable, always-on storage layer that never goes dark. The web reads from
these JSON files when the database is empty or unreachable.

File layout:
    services/data-pipeline/snapshots/
      <bank>/
        latest.json                       # most recent snapshot for this bank
        history/YYYY-MM-DDTHH-MM-SSZ.json # per-run append (kept forever)

The orchestrator calls `write_snapshot_files()` after every successful
compute. It is idempotent within a UTC second.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)


def _serialize(obj):
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def write_snapshot_files(
    snapshot_dir: Path,
    bank_code: str,
    probabilities: Iterable,
    snapshot_at: datetime | None = None,
    methodology_version: str = "1.0.0",
    estimation_basis: str | None = None,
) -> tuple[Path, Path]:
    """Persist a probability batch as JSON. Returns (latest_path, history_path).

    Each `probabilities` element must have:
      .meeting_date (date), .outcome_label (str), .outcome_delta_bps (int),
      .probability (float), .post_meeting_rate (float)
    """
    if snapshot_at is None:
        snapshot_at = datetime.now(UTC).replace(microsecond=0)

    rows = []
    for p in probabilities:
        d = asdict(p) if hasattr(p, "__dataclass_fields__") else dict(p.__dict__)
        rows.append(d)

    bank_dir = snapshot_dir / bank_code.lower()
    history_dir = bank_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)

    stamp = snapshot_at.strftime("%Y-%m-%dT%H-%M-%SZ")
    payload = {
        "bank_code": bank_code.upper(),
        "snapshot_at": snapshot_at.isoformat(),
        "methodology_version": methodology_version,
        "estimation_basis": estimation_basis,
        "rows": rows,
    }
    history_path = history_dir / f"{stamp}.json"
    history_path.write_text(
        json.dumps(payload, indent=2, default=_serialize) + "\n",
        encoding="utf-8",
    )

    latest_path = bank_dir / "latest.json"
    latest_path.write_text(
        json.dumps(payload, indent=2, default=_serialize) + "\n",
        encoding="utf-8",
    )

    # Rebuild the per-bank time series file by aggregating every history file.
    # The web reads this single file to render the historical chart without
    # needing a directory listing.
    _rebuild_series(bank_dir, bank_code.upper())

    logger.info(
        "Wrote %d snapshot rows for %s to %s",
        len(rows),
        bank_code.upper(),
        history_path.name,
    )
    return latest_path, history_path


def _rebuild_series(bank_dir: Path, bank_code: str) -> Path:
    """Aggregate every history file under `bank_dir/history/` into series.json.

    Format:
      {
        "bank_code": "FED",
        "series": {
           "2026-06-17": [
             { "snapshot_at": "...", "outcome_label": "Hold", "delta_bps": 0,
               "probability": 0.81, "post_meeting_rate": 4.375 },
             ...
           ],
           ...
        }
      }
    """
    history_dir = bank_dir / "history"
    by_meeting: dict[str, list[dict]] = {}
    if history_dir.exists():
        for path in sorted(history_dir.iterdir()):
            if not path.name.endswith(".json"):
                continue
            try:
                file_payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            snap_at = file_payload.get("snapshot_at")
            for row in file_payload.get("rows", []):
                meeting = row.get("meeting_date")
                if not meeting:
                    continue
                point = {
                    "snapshot_at": snap_at,
                    "outcome_label": row.get("outcome_label"),
                    "delta_bps": row.get("outcome_delta_bps"),
                    "probability": row.get("probability"),
                    "post_meeting_rate": row.get("post_meeting_rate"),
                }
                by_meeting.setdefault(str(meeting), []).append(point)

    series_path = bank_dir / "series.json"
    series_path.write_text(
        json.dumps(
            {"bank_code": bank_code, "series": by_meeting},
            indent=2,
            default=_serialize,
        )
        + "\n",
        encoding="utf-8",
    )
    return series_path
