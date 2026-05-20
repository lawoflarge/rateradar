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
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


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


# Minimum age of the "prior" snapshot point we compare against.
# Cron runs twice a day (~18h and ~22h UTC). To get a true "yesterday vs today"
# delta — not "this morning vs this afternoon" — require the prior point to
# be at least PRIOR_MIN_AGE_HOURS old.
PRIOR_MIN_AGE_HOURS = 18


def _pick_prior_point(
    series_points: list[SeriesPoint], delta_bps: int, now: datetime
) -> SeriesPoint | None:
    """Most recent point with matching delta_bps and snapshot_at <= now - 18h."""
    cutoff_dt = now - timedelta(hours=PRIOR_MIN_AGE_HOURS)
    candidates = [
        p for p in series_points
        if p.delta_bps == delta_bps
        and datetime.fromisoformat(p.snapshot_at) <= cutoff_dt
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.snapshot_at)


def compute_brief(
    fed_snapshot: Snapshot,
    ecb_snapshot: Snapshot,
    fed_series: dict[str, list[SeriesPoint]],
    ecb_series: dict[str, list[SeriesPoint]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Return the Daily Brief JSON for `now` (defaults to UTC now).

    Schema:
      {
        "date": "YYYY-MM-DD",
        "generated_at": "<ISO>",
        "headline": {
          "meeting_id": "FED-2026-06-17",
          "bank_code": "FED",
          "meeting_date": "2026-06-17",
          "outcome_label": "Hold",
          "outcome_delta_bps": 0,
          "prior_probability": 0.45,
          "current_probability": 0.55,
          "delta_pp": 10.0
        },
        "top_shifts": [<up to 3 same-shape entries>],
        "calendar_context": []   # populated in PR-3 by FRED lookup
      }
    """
    now = now or datetime.now(UTC)
    today = now.date().isoformat()

    shifts: list[dict[str, Any]] = []
    for snap, series in ((fed_snapshot, fed_series), (ecb_snapshot, ecb_series)):
        for row in snap.rows:
            points = series.get(row.meeting_date) or []
            prior = _pick_prior_point(points, row.outcome_delta_bps, now)
            if prior is None:
                continue
            delta_pp = (row.probability - prior.probability) * 100.0
            shifts.append(
                {
                    "meeting_id": f"{snap.bank_code}-{row.meeting_date}",
                    "bank_code": snap.bank_code,
                    "meeting_date": row.meeting_date,
                    "outcome_label": row.outcome_label,
                    "outcome_delta_bps": row.outcome_delta_bps,
                    "prior_probability": prior.probability,
                    "current_probability": row.probability,
                    "delta_pp": delta_pp,
                }
            )

    shifts.sort(key=lambda s: abs(s["delta_pp"]), reverse=True)
    headline = shifts[0] if shifts else None
    top_shifts = shifts[:3]

    return {
        "date": today,
        "generated_at": now.isoformat(),
        "headline": headline,
        "top_shifts": top_shifts,
        "calendar_context": [],
    }


def compute_meeting_timeline(
    bank_code: str, meeting_date: str, series_points: list[SeriesPoint]
) -> dict[str, Any]:
    """Return per-meeting annotated timeline JSON.

    Schema:
      {
        "meeting_id": "FED-2026-06-17",
        "bank_code": "FED",
        "meeting_date": "2026-06-17",
        "series": { -25: [{snapshot_at, probability}, ...], 0: [...], ... },
        "top_shifts": [
          { "from_snapshot_at": "...", "to_snapshot_at": "...",
            "outcome_label": "Hold", "outcome_delta_bps": 0,
            "from_probability": 0.30, "to_probability": 0.55,
            "delta_pp": 25.0 },
          ... up to 3 ...
        ]
      }
    """
    by_outcome: dict[int, list[SeriesPoint]] = {}
    for p in series_points:
        by_outcome.setdefault(p.delta_bps, []).append(p)
    for k in by_outcome:
        by_outcome[k].sort(key=lambda p: p.snapshot_at)

    series_out: dict[int, list[dict[str, Any]]] = {}
    for delta_bps, points in by_outcome.items():
        series_out[delta_bps] = [
            {"snapshot_at": p.snapshot_at, "probability": p.probability}
            for p in points
        ]

    shifts: list[dict[str, Any]] = []
    for delta_bps, points in by_outcome.items():
        for prev, cur in zip(points, points[1:]):
            delta_pp = (cur.probability - prev.probability) * 100.0
            if abs(delta_pp) < 0.5:  # ignore noise below 0.5pp
                continue
            shifts.append(
                {
                    "from_snapshot_at": prev.snapshot_at,
                    "to_snapshot_at": cur.snapshot_at,
                    "outcome_label": cur.outcome_label,
                    "outcome_delta_bps": delta_bps,
                    "from_probability": prev.probability,
                    "to_probability": cur.probability,
                    "delta_pp": delta_pp,
                }
            )
    shifts.sort(key=lambda s: abs(s["delta_pp"]), reverse=True)

    return {
        "meeting_id": f"{bank_code.upper()}-{meeting_date}",
        "bank_code": bank_code.upper(),
        "meeting_date": meeting_date,
        "series": series_out,
        "top_shifts": shifts[:3],
    }


# Window in hours: a series point counts as "day-before snapshot" if its
# snapshot_at falls between (meeting_midnight - DAY_BEFORE_MAX_HOURS) and
# (meeting_midnight - DAY_BEFORE_MIN_HOURS).
DAY_BEFORE_MIN_HOURS = 12
DAY_BEFORE_MAX_HOURS = 48


def _day_before_snapshot(
    series_points: list[SeriesPoint], meeting_date: str
) -> list[SeriesPoint] | None:
    """Return the snapshot row set taken 12-48h before meeting midnight UTC.

    Returns the list of points (one per outcome) sharing the latest qualifying
    snapshot_at, or None if no qualifying point exists.

    Uses datetime parsing for the cross-source comparison (cutoffs vs series
    points) — the lexicographic string compare would silently break if any
    series point ever carried a non-UTC offset.
    """
    # Anchor to meeting noon (12:00 UTC) — central bank decisions happen during
    # the day, not at midnight. This places evening-before snapshots (e.g. 22:00
    # the prior day = 14h before noon) squarely inside the 12-48h window.
    meeting_dt = datetime.fromisoformat(meeting_date + "T12:00:00+00:00")
    upper_dt = meeting_dt - timedelta(hours=DAY_BEFORE_MIN_HOURS)
    lower_dt = meeting_dt - timedelta(hours=DAY_BEFORE_MAX_HOURS)

    qualifying = [
        p for p in series_points
        if lower_dt <= datetime.fromisoformat(p.snapshot_at) <= upper_dt
    ]
    if not qualifying:
        return None
    chosen_at = max(qualifying, key=lambda p: p.snapshot_at).snapshot_at
    return [p for p in qualifying if p.snapshot_at == chosen_at]


def compute_scoreboard(
    *,
    actuals: list[Actual],
    fed_series: dict[str, list[SeriesPoint]],
    ecb_series: dict[str, list[SeriesPoint]],
) -> dict[str, Any]:
    """Return scoreboard JSON aggregated from actuals + series.

    Schema:
      {
        "generated_at": "<ISO>",
        "total_meetings": int,                  # how many actuals had a usable snapshot
        "overall_hit_rate": float | null,       # null if total_meetings == 0
        "per_bank": { "FED": float|null, "ECB": float|null },
        "biggest_misses": [
          { "meeting_id", "bank_code", "actual_decision_bps",
            "day_before_top_outcome_delta_bps",
            "day_before_top_probability", "miss_magnitude" },
          ... top 5 ...
        ],
        "longest_streak": int,                  # consecutive most-recent hits
        "history": [ { meeting_id, bank_code, hit: bool, meeting_date }, ... ]
      }
    """
    by_bank = {"FED": fed_series, "ECB": ecb_series}

    history: list[dict[str, Any]] = []
    misses: list[dict[str, Any]] = []

    for actual in actuals:
        bank, _, _ = actual.meeting_id.partition("-")
        series = by_bank.get(bank, {})
        meeting_date = actual.meeting_id.split("-", 1)[1]
        day_before = _day_before_snapshot(series.get(meeting_date, []), meeting_date)
        if day_before is None:
            continue  # no usable snapshot — exclude from stats
        top = max(day_before, key=lambda p: p.probability)
        hit = top.delta_bps == actual.decision_bps
        history.append(
            {
                "meeting_id": actual.meeting_id,
                "bank_code": bank,
                "meeting_date": meeting_date,
                "hit": hit,
            }
        )
        if not hit:
            misses.append(
                {
                    "meeting_id": actual.meeting_id,
                    "bank_code": bank,
                    "actual_decision_bps": actual.decision_bps,
                    "day_before_top_outcome_delta_bps": top.delta_bps,
                    "day_before_top_probability": top.probability,
                    "miss_magnitude": top.probability,
                }
            )

    history.sort(key=lambda h: h["meeting_date"])

    total = len(history)
    hits = sum(1 for h in history if h["hit"])
    overall: float | None = (hits / total) if total else None

    per_bank: dict[str, float | None] = {"FED": None, "ECB": None}
    for bank in per_bank.keys():
        bank_rows = [h for h in history if h["bank_code"] == bank]
        if bank_rows:
            per_bank[bank] = sum(1 for h in bank_rows if h["hit"]) / len(bank_rows)

    longest = 0
    streak = 0
    for h in reversed(history):
        if h["hit"]:
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 0

    misses.sort(key=lambda m: m["miss_magnitude"], reverse=True)

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "total_meetings": total,
        "overall_hit_rate": overall,
        "per_bank": per_bank,
        "biggest_misses": misses[:5],
        "longest_streak": longest,
        "history": history,
    }
