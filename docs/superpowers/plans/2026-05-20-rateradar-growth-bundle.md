# RateRadar Growth Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation PR (PR-1) of the five-feature visitor-attraction bundle described in `docs/superpowers/specs/2026-05-20-rateradar-growth-bundle-design.md`. PR-1 produces the cron-driven static content layer that PR-2..5 consume.

**Architecture:** A pure-Python "diff engine" runs inside the existing GitHub Actions cron, reads the snapshot files the pipeline already writes, and emits derived JSON + SVG into a new `content/` directory at the repo root. The diff engine has no network I/O and no new external dependencies. Outputs are committed to the repo by the same job that already commits snapshots.

**Tech Stack:** Python 3.11, pytest, black + ruff (existing pipeline conventions). GitHub Actions for the cron. Existing `services/data-pipeline/` package.

---

## Scope of this plan

This document covers **PR-1 only** in detail. The spec sequences five PRs; PR-2..5 are outlined at the bottom. Each subsequent PR gets its own detailed plan after its predecessor merges. Rationale: PR-2..5 consume the exact JSON shapes that PR-1 emits — writing detailed code for them now risks "the shape will be defined in PR-1" placeholders.

| PR | Scope | Plan status |
|---|---|---|
| **PR-1** | Foundation: diff engine + cron integration | **Detailed below** |
| PR-2 | A2 Rich meeting pages | Outline only; detailed plan after PR-1 merges |
| PR-3 | A1 Daily Brief + RSS | Outline only |
| PR-4 | C1 Embed widget + `/embed` promo | Outline only |
| PR-5 | B1 Scoreboard + B2 interactive replay | Outline only |

## Course corrections from the spec

Three deviations from the spec, made during plan-writing review:

1. **FRED calendar lookup deferred from PR-1 to PR-3.** The spec said "FRED already a project dependency" — on inspection it isn't (only mentioned in `CLAUDE.md` as a planned source). Wiring FRED into PR-1 would add a new dependency + a new secret. Cleaner to defer to PR-3 (where calendar annotations are actually rendered). PR-1 emits a `calendar_context: []` placeholder in the brief JSON; PR-3 will populate it.
2. **PR-1 stays out of `apps/web` entirely.** The spec listed `apps/web/src/lib/content.ts` in §8 NEW files. That loader has no consumer until PR-2, so it moves to PR-2 where it can be properly tested against a real page. Keeps PR-1 reviewable as a pure data PR.
3. **One PR-1 commit per task.** The spec talked in terms of feature PRs; this plan adds the bite-sized commit granularity inside PR-1 so each step is independently reverable.

## File structure (PR-1)

**New files**
- `services/data-pipeline/src/diff_engine.py` — main module: loaders, computation, CLI.
- `services/data-pipeline/tests/test_diff_engine.py` — pytest unit + integration tests.
- `services/data-pipeline/actuals.json` — manually-maintained list of past meeting outcomes (seeded empty in PR-1).
- `content/.gitkeep` — anchors the new content directory at repo root.
- `content/briefs/.gitkeep`
- `content/meetings/.gitkeep`
- `content/embed/.gitkeep`

**Modified files**
- `.github/workflows/pipeline-cron.yml` — add a "run diff engine" step inside the existing `commit-snapshots` job, before the `git add`.
- `docs/PRD.md` — note the new content surfaces in scope (one paragraph addition).
- `docs/ARCHITECTURE.md` — add the diff engine arrow to the data flow diagram (small text edit).

**Untouched in PR-1**
- Everything under `apps/web/` (consumers come in PR-2..5).
- Everything under `apps/ios-expo/` (WebView shell unchanged).
- `services/data-pipeline/src/main.py` (diff engine is a separate CLI; no changes to the existing pipeline orchestrator).

## How `diff_engine` plugs into the cron

The existing workflow has two jobs:
1. `run` — matrix over `[fed, ecb]`, runs `python -m src.main ... --json-snapshot-dir snapshots`, uploads snapshot artifacts.
2. `commit-snapshots` — downloads all artifacts, stages them, commits + pushes.

The diff engine needs both banks' data, so it runs in `commit-snapshots` **after** artifact download and **before** `git add`. That way one atomic commit contains both the snapshots and the derived content. No new GitHub Actions secrets. No new permissions.

---

## Task 1: Create branch + content directory anchors

**Files:**
- Create: `content/.gitkeep`
- Create: `content/briefs/.gitkeep`
- Create: `content/meetings/.gitkeep`
- Create: `content/embed/.gitkeep`

- [ ] **Step 1: Create branch from `main`**

```bash
cd /c/Users/levin/rateradar
git checkout main
git pull origin main
git checkout -b feat/pr1-diff-engine
```

Expected: `Switched to a new branch 'feat/pr1-diff-engine'`.

- [ ] **Step 2: Create the directory anchors**

```bash
mkdir -p content/briefs content/meetings content/embed
touch content/.gitkeep content/briefs/.gitkeep content/meetings/.gitkeep content/embed/.gitkeep
```

- [ ] **Step 3: Verify the layout**

```bash
ls content/ content/briefs/ content/meetings/ content/embed/
```

Expected: each directory listed and contains `.gitkeep`.

- [ ] **Step 4: Commit**

```bash
git add content/
git commit -m "chore(content): anchor content/ directories for diff engine output"
```

---

## Task 2: Add `actuals.json` seed

**Files:**
- Create: `services/data-pipeline/actuals.json`

- [ ] **Step 1: Write the seed file**

Create `services/data-pipeline/actuals.json` with exactly this content:

```json
[]
```

That's a JSON empty array. One line, no trailing whitespace.

- [ ] **Step 2: Document the shape inline in `diff_engine.py` (placeholder — Task 3 finishes it)**

(Documentation lands with Task 3's docstring; for now the bare seed is enough.)

- [ ] **Step 3: Commit**

```bash
git add services/data-pipeline/actuals.json
git commit -m "feat(pipeline): add actuals.json seed for scoreboard"
```

---

## Task 3: Scaffold `diff_engine.py` with loaders + failing import test

**Files:**
- Create: `services/data-pipeline/src/diff_engine.py`
- Create: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Write the failing test**

Create `services/data-pipeline/tests/test_diff_engine.py`:

```python
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
```

- [ ] **Step 2: Run the test — expect it to fail (module does not exist yet)**

```bash
cd services/data-pipeline
pytest tests/test_diff_engine.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.diff_engine'`.

- [ ] **Step 3: Create the module with loaders**

Create `services/data-pipeline/src/diff_engine.py`:

```python
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
from dataclasses import dataclass, field
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
    """Read actuals.json. Returns [] if file missing or empty array."""
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        Actual(
            meeting_id=str(row["meeting_id"]),
            decision=str(row["decision"]),
            decision_bps=int(row["decision_bps"]),
            effective_date=str(row["effective_date"]),
        )
        for row in data
    ]
```

- [ ] **Step 4: Run the tests — expect them to pass**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): diff_engine scaffold + loaders"
```

---

## Task 4: Implement `compute_brief()` — TDD

**Files:**
- Modify: `services/data-pipeline/src/diff_engine.py`
- Modify: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Add failing test**

Append to `services/data-pipeline/tests/test_diff_engine.py`:

```python
from datetime import datetime, timedelta, timezone


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

    label = "Hold" if delta_bps == 0 else f"{delta_bps:+d}bp".replace("+", "+")
    return SeriesPoint(
        snapshot_at=snapshot_at,
        outcome_label=label,
        delta_bps=delta_bps,
        probability=prob,
    )


def test_compute_brief_picks_largest_abs_shift_as_headline():
    from src.diff_engine import compute_brief

    now = datetime(2026, 5, 20, 23, 0, tzinfo=timezone.utc)
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

    now = datetime(2026, 5, 20, 23, 0, tzinfo=timezone.utc)
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
    """Prior must be at least 18h ago to count as "yesterday's number"."""
    from src.diff_engine import compute_brief

    now = datetime(2026, 5, 20, 23, 0, tzinfo=timezone.utc)
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
```

- [ ] **Step 2: Run the new tests — expect them to fail**

```bash
pytest tests/test_diff_engine.py::test_compute_brief_picks_largest_abs_shift_as_headline -v
```

Expected: `ImportError: cannot import name 'compute_brief' from 'src.diff_engine'`.

- [ ] **Step 3: Implement `compute_brief()` in `diff_engine.py`**

Append to `services/data-pipeline/src/diff_engine.py`:

```python
from datetime import UTC, datetime, timedelta


# Minimum age of the "prior" snapshot point we compare against.
# Cron runs twice a day (~18h and ~22h UTC). To get a true "yesterday vs today"
# delta — not "this morning vs this afternoon" — require the prior point to
# be at least PRIOR_MIN_AGE_HOURS old.
PRIOR_MIN_AGE_HOURS = 18


def _pick_prior_point(
    series_points: list[SeriesPoint], delta_bps: int, now: datetime
) -> SeriesPoint | None:
    """Most recent point with matching delta_bps and snapshot_at <= now - 18h."""
    cutoff = (now - timedelta(hours=PRIOR_MIN_AGE_HOURS)).isoformat()
    candidates = [
        p for p in series_points
        if p.delta_bps == delta_bps and p.snapshot_at <= cutoff
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
) -> dict:
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

    shifts: list[dict] = []
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
```

- [ ] **Step 4: Run all diff_engine tests — expect green**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): compute_brief — top shifts over 18h"
```

---

## Task 5: Implement `compute_meeting_timeline()` — TDD

**Files:**
- Modify: `services/data-pipeline/src/diff_engine.py`
- Modify: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Add failing test**

Append to `services/data-pipeline/tests/test_diff_engine.py`:

```python
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
```

- [ ] **Step 2: Run — expect fail**

```bash
pytest tests/test_diff_engine.py::test_compute_meeting_timeline_emits_full_series_and_top3_shifts -v
```

Expected: `ImportError: cannot import name 'compute_meeting_timeline'`.

- [ ] **Step 3: Implement**

Append to `services/data-pipeline/src/diff_engine.py`:

```python
def compute_meeting_timeline(
    bank_code: str, meeting_date: str, series_points: list[SeriesPoint]
) -> dict:
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

    series_out: dict[int, list[dict]] = {}
    for delta_bps, points in by_outcome.items():
        series_out[delta_bps] = [
            {"snapshot_at": p.snapshot_at, "probability": p.probability}
            for p in points
        ]

    shifts: list[dict] = []
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
```

- [ ] **Step 4: Run all tests — expect green**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): compute_meeting_timeline — series + top3 shifts"
```

---

## Task 6: Implement `compute_scoreboard()` — TDD

**Files:**
- Modify: `services/data-pipeline/src/diff_engine.py`
- Modify: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Add failing test**

Append to `services/data-pipeline/tests/test_diff_engine.py`:

```python
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
```

- [ ] **Step 2: Run — expect fail**

```bash
pytest tests/test_diff_engine.py::test_compute_scoreboard_no_actuals_returns_zero_stats -v
```

Expected: `ImportError: cannot import name 'compute_scoreboard'`.

- [ ] **Step 3: Implement**

Append to `services/data-pipeline/src/diff_engine.py`:

```python
# Maximum age in hours: a series point counts as the "day-before snapshot"
# if it's the latest point at least DAY_BEFORE_MIN_HOURS old before the meeting.
DAY_BEFORE_MIN_HOURS = 12
DAY_BEFORE_MAX_HOURS = 48


def _day_before_snapshot(
    series_points: list[SeriesPoint], meeting_date: str
) -> list[SeriesPoint] | None:
    """Return the snapshot row set taken 12-48h before meeting midnight UTC.

    Returns the list of points (one per outcome) sharing the latest qualifying
    snapshot_at, or None if no qualifying point exists.
    """
    meeting_dt = datetime.fromisoformat(meeting_date + "T00:00:00+00:00")
    upper = (meeting_dt - timedelta(hours=DAY_BEFORE_MIN_HOURS)).isoformat()
    lower = (meeting_dt - timedelta(hours=DAY_BEFORE_MAX_HOURS)).isoformat()

    qualifying = [p for p in series_points if lower <= p.snapshot_at <= upper]
    if not qualifying:
        return None
    chosen_at = max(qualifying, key=lambda p: p.snapshot_at).snapshot_at
    return [p for p in qualifying if p.snapshot_at == chosen_at]


def compute_scoreboard(
    *,
    actuals: list[Actual],
    fed_series: dict[str, list[SeriesPoint]],
    ecb_series: dict[str, list[SeriesPoint]],
) -> dict:
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

    history: list[dict] = []
    misses: list[dict] = []

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
    overall = (hits / total) if total else None

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
```

- [ ] **Step 4: Run all tests — expect green**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): compute_scoreboard — hit rate, biggest misses, streak"
```

---

## Task 7: Implement `render_embed_svg()` — TDD

**Files:**
- Modify: `services/data-pipeline/src/diff_engine.py`
- Modify: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Add failing test**

Append to `services/data-pipeline/tests/test_diff_engine.py`:

```python
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
```

- [ ] **Step 2: Run — expect fail**

```bash
pytest tests/test_diff_engine.py::test_render_embed_svg_contains_expected_substrings -v
```

Expected: `ImportError: cannot import name 'render_embed_svg'`.

- [ ] **Step 3: Implement**

Append to `services/data-pipeline/src/diff_engine.py`:

```python
# Wire Room palette (mirrors apps/web/src/app/globals.css tokens).
_WIRE = {
    "paper": "#F5F1E8",
    "ink": "#0E0E0E",
    "ink_soft": "#3C3935",
    "ink_mute": "#7A7570",
    "cut": "#C8841C",
    "hike": "#A8312A",
    "hold": "#3E5640",
    "rule": "#0E0E0E33",
}


def _outcome_color(delta_bps: int) -> str:
    if delta_bps < 0:
        return _WIRE["cut"]
    if delta_bps > 0:
        return _WIRE["hike"]
    return _WIRE["hold"]


def _sparkline_path(
    points: list[float], x0: int, y0: int, width: int, height: int
) -> str:
    if len(points) < 2:
        return ""
    lo, hi = 0.0, 1.0  # probabilities are always [0, 1]
    n = len(points)
    coords = []
    for i, p in enumerate(points):
        x = x0 + (i / (n - 1)) * width
        y = y0 + height - ((p - lo) / (hi - lo)) * height
        coords.append(f"{x:.1f},{y:.1f}")
    return "M " + " L ".join(coords)


def _short_date(meeting_date: str) -> str:
    """`2026-06-17` -> `Jun 17, 2026`."""
    dt = datetime.fromisoformat(meeting_date + "T00:00:00+00:00")
    return dt.strftime("%b %d, %Y")


def render_embed_svg(
    bank_code: str,
    meeting_date: str,
    snapshot: Snapshot,
    series: dict[str, list[SeriesPoint]],
) -> str:
    """Render a 600x200 Wire Room embed card. Returns the full SVG text.

    Contract: must include "Powered by RateRadar" and stay under 5KB.
    """
    rows_for_meeting = [r for r in snapshot.rows if r.meeting_date == meeting_date]
    if not rows_for_meeting:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" '
            'width="600" height="200">'
            f'<rect width="600" height="200" fill="{_WIRE["paper"]}"/>'
            f'<text x="300" y="100" text-anchor="middle" font-family="sans-serif" '
            f'font-size="14" fill="{_WIRE["ink_mute"]}">No data available</text>'
            f'<text x="300" y="175" text-anchor="middle" font-family="sans-serif" '
            f'font-size="10" fill="{_WIRE["ink_mute"]}">Powered by RateRadar</text>'
            "</svg>"
        )

    top = max(rows_for_meeting, key=lambda r: r.probability)
    color = _outcome_color(top.outcome_delta_bps)

    pts = series.get(meeting_date, [])
    top_pts = sorted(
        (p for p in pts if p.delta_bps == top.outcome_delta_bps),
        key=lambda p: p.snapshot_at,
    )
    sparkline_d = _sparkline_path(
        [p.probability for p in top_pts], x0=360, y0=60, width=220, height=80
    )

    pct = round(top.probability * 100)
    bank_label = "Federal Reserve" if bank_code == "FED" else "European Central Bank"
    outcome_word = "Hold rates" if top.outcome_label == "Hold" else f"Move {top.outcome_label}"

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" '
        'width="600" height="200" role="img" '
        f'aria-label="RateRadar live odds for {bank_code} {meeting_date}">'
        f'<rect width="600" height="200" fill="{_WIRE["paper"]}"/>'
        f'<text x="20" y="30" font-family="sans-serif" font-size="11" '
        f'letter-spacing="1.5" fill="{_WIRE["ink_mute"]}">'
        f"{bank_label.upper()} · {_short_date(meeting_date).upper()}</text>"
        f'<text x="20" y="80" font-family="Georgia, serif" font-size="32" '
        f'fill="{_WIRE["ink"]}">{outcome_word}</text>'
        f'<text x="20" y="130" font-family="monospace" font-size="42" '
        f'fill="{color}">{pct}%</text>'
        f'<text x="20" y="155" font-family="sans-serif" font-size="11" '
        f'fill="{_WIRE["ink_mute"]}">market-implied probability</text>'
        f'<path d="{sparkline_d}" stroke="{color}" stroke-width="1.5" fill="none"/>'
        f'<line x1="20" y1="180" x2="580" y2="180" stroke="{_WIRE["rule"]}"/>'
        f'<text x="20" y="195" font-family="sans-serif" font-size="10" '
        f'fill="{_WIRE["ink_mute"]}">Powered by RateRadar · '
        f'rateradar-web.vercel.app</text>'
        "</svg>"
    )
```

- [ ] **Step 4: Run all tests — expect green**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 15 passed.

- [ ] **Step 5: Commit**

```bash
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): render_embed_svg — 600x200 Wire Room card"
```

---

## Task 8: Add the CLI entrypoint + file writer

**Files:**
- Modify: `services/data-pipeline/src/diff_engine.py`
- Modify: `services/data-pipeline/tests/test_diff_engine.py`

- [ ] **Step 1: Add failing integration test**

Append to `services/data-pipeline/tests/test_diff_engine.py`:

```python
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
```

- [ ] **Step 2: Run — expect fail**

```bash
pytest tests/test_diff_engine.py::test_run_writes_all_expected_files -v
```

Expected: `ImportError: cannot import name 'run'`.

- [ ] **Step 3: Implement `run()` + `main()` CLI**

Append to `services/data-pipeline/src/diff_engine.py`:

```python
def _write_json(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _read_existing_brief_index(content_dir: Path) -> list[dict]:
    """Read content/briefs/index.json if it exists, else return []."""
    p = content_dir / "briefs" / "index.json"
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return list(data.get("briefs", []))
    except Exception:
        return []


def run(
    *,
    snapshots_dir: Path,
    actuals_path: Path,
    content_dir: Path,
    now_iso: str | None = None,
) -> None:
    """Run the full diff engine: read snapshots, write all derived content.

    Idempotent within a UTC second — overwrites today's brief on each run.
    Multiple runs per day intentionally clobber earlier briefs; the latest
    snapshot is the source of truth for that day.
    """
    now = (
        datetime.fromisoformat(now_iso) if now_iso else datetime.now(UTC)
    )

    fed_snap = load_snapshot(snapshots_dir, "FED")
    ecb_snap = load_snapshot(snapshots_dir, "ECB")
    fed_series = load_series(snapshots_dir, "FED")
    ecb_series = load_series(snapshots_dir, "ECB")
    actuals = load_actuals(actuals_path)

    # --- Brief ---
    if fed_snap and ecb_snap:
        brief = compute_brief(
            fed_snap, ecb_snap, fed_series, ecb_series, now=now
        )
        _write_json(content_dir / "briefs" / f"{brief['date']}.json", brief)

        index_entries = _read_existing_brief_index(content_dir)
        existing_dates = {e["date"] for e in index_entries}
        if brief["date"] not in existing_dates:
            index_entries.append({"date": brief["date"]})
        # Sort newest first; also overwrite headline summary in index for today.
        for e in index_entries:
            if e["date"] == brief["date"]:
                e["headline_meeting_id"] = (
                    brief["headline"]["meeting_id"] if brief["headline"] else None
                )
                e["headline_delta_pp"] = (
                    brief["headline"]["delta_pp"] if brief["headline"] else None
                )
        index_entries.sort(key=lambda e: e["date"], reverse=True)
        _write_json(
            content_dir / "briefs" / "index.json",
            {"generated_at": now.isoformat(), "briefs": index_entries},
        )

    # --- Per-meeting timelines + embed SVGs (one of each per upcoming meeting) ---
    today_iso = now.date().isoformat()
    for snap, series in ((fed_snap, fed_series), (ecb_snap, ecb_series)):
        if snap is None:
            continue
        meeting_dates = sorted({r.meeting_date for r in snap.rows})
        for md in meeting_dates:
            if md < today_iso:
                continue  # skip past meetings; their pages are evergreen but
                          # the data doesn't change
            tl = compute_meeting_timeline(snap.bank_code, md, series.get(md, []))
            _write_json(
                content_dir / "meetings" / tl["meeting_id"] / "timeline.json", tl
            )
            svg = render_embed_svg(snap.bank_code, md, snap, series)
            embed_path = content_dir / "embed" / f"{tl['meeting_id']}.svg"
            embed_path.parent.mkdir(parents=True, exist_ok=True)
            embed_path.write_text(svg, encoding="utf-8")

    # --- Scoreboard ---
    scoreboard = compute_scoreboard(
        actuals=actuals, fed_series=fed_series, ecb_series=ecb_series
    )
    _write_json(content_dir / "scoreboard.json", scoreboard)


def main() -> int:
    parser = argparse.ArgumentParser(description="RateRadar diff engine")
    parser.add_argument(
        "--snapshots-dir",
        type=Path,
        default=Path("services/data-pipeline/snapshots"),
        help="Root snapshots dir (contains fed/, ecb/).",
    )
    parser.add_argument(
        "--actuals-path",
        type=Path,
        default=Path("services/data-pipeline/actuals.json"),
        help="Manually-maintained actuals file.",
    )
    parser.add_argument(
        "--content-dir",
        type=Path,
        default=Path("content"),
        help="Output content dir (will be created).",
    )
    args = parser.parse_args()

    run(
        snapshots_dir=args.snapshots_dir,
        actuals_path=args.actuals_path,
        content_dir=args.content_dir,
    )
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
```

Also add this import line near the top of the module (with the other imports):

```python
import argparse
```

- [ ] **Step 4: Run all tests — expect green**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 16 passed.

- [ ] **Step 5: Run the CLI against real local data and inspect the output**

```bash
cd /c/Users/levin/rateradar
python -m src.diff_engine \
  --snapshots-dir services/data-pipeline/snapshots \
  --actuals-path services/data-pipeline/actuals.json \
  --content-dir content
# Then look at what came out:
ls content/briefs/ content/meetings/ content/embed/
cat content/briefs/index.json
```

The exact run command above assumes you cd'd into `services/data-pipeline` first OR adjusted PYTHONPATH. The Python module path is `src.diff_engine` because the package is `src/` inside `services/data-pipeline/`. From repo root:

```bash
cd services/data-pipeline
python -m src.diff_engine \
  --snapshots-dir snapshots \
  --actuals-path actuals.json \
  --content-dir ../../content
ls ../../content/briefs/ ../../content/meetings/ ../../content/embed/
```

Expected: `content/briefs/<today>.json`, `content/briefs/index.json`, `content/meetings/FED-*/timeline.json`, `content/meetings/ECB-*/timeline.json`, `content/scoreboard.json`, and several `content/embed/<meeting>.svg` files.

- [ ] **Step 6: Eyeball an SVG**

```bash
cd /c/Users/levin/rateradar
ls content/embed/
# Open one of them in a browser — it should render the Wire Room card.
```

If it looks broken, fix `render_embed_svg()` and re-run from Step 5. Do not move on until the SVG renders.

- [ ] **Step 7: Stage the real generated outputs (these are the first ones, so they're tracked)**

```bash
git add content/ services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "feat(pipeline): diff_engine run() + CLI + first-run content"
```

---

## Task 9: Lint + format

**Files:** modified files from previous tasks.

- [ ] **Step 1: Run black and ruff**

```bash
cd /c/Users/levin/rateradar/services/data-pipeline
black src/diff_engine.py tests/test_diff_engine.py
ruff check src/diff_engine.py tests/test_diff_engine.py --fix
```

- [ ] **Step 2: Re-run tests to be sure formatters didn't break anything**

```bash
pytest tests/test_diff_engine.py -v
```

Expected: 16 passed.

- [ ] **Step 3: Commit if anything changed**

```bash
git status
# If diff_engine.py / test_diff_engine.py are dirty:
git add services/data-pipeline/src/diff_engine.py services/data-pipeline/tests/test_diff_engine.py
git commit -m "style(pipeline): black + ruff diff_engine"
# Else skip.
```

---

## Task 10: Wire `diff_engine` into the pipeline cron

**Files:**
- Modify: `.github/workflows/pipeline-cron.yml`

- [ ] **Step 1: Open `.github/workflows/pipeline-cron.yml`**

Read the file. We are modifying the `commit-snapshots` job. The diff-engine step goes AFTER `Stage snapshot files` and BEFORE `Commit and push snapshots`, so the derived content lands in the same atomic commit.

- [ ] **Step 2: Replace the `commit-snapshots` job with this version**

Open `.github/workflows/pipeline-cron.yml` and replace the `commit-snapshots:` job (lines 74-111 in the current file) with:

```yaml
  commit-snapshots:
    needs: run
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Download all snapshot artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
      - name: Stage snapshot files
        run: |
          set -e
          mkdir -p services/data-pipeline/snapshots
          for bank in fed ecb; do
            for dir in artifacts/snapshot-${bank}-*; do
              if [ -d "$dir" ]; then
                mkdir -p "services/data-pipeline/snapshots/${bank}"
                cp -r "$dir"/. "services/data-pipeline/snapshots/${bank}/"
              fi
            done
          done
      - name: Run diff engine
        working-directory: services/data-pipeline
        run: |
          set -e
          python -m src.diff_engine \
            --snapshots-dir snapshots \
            --actuals-path actuals.json \
            --content-dir ../../content
      - name: Commit and push snapshots + derived content
        run: |
          set -e
          git config user.name  "rateradar-bot"
          git config user.email "rateradar-bot@users.noreply.github.com"
          git add services/data-pipeline/snapshots content
          if git diff --cached --quiet; then
            echo "No snapshot or content changes to commit."
            exit 0
          fi
          # Avoid race with concurrent pushes by rebasing onto the latest tip.
          git pull --rebase --autostash origin "${GITHUB_REF_NAME}"
          stamp=$(date -u +'%Y-%m-%dT%H:%MZ')
          git commit -m "data(snapshot+content): pipeline cron @ ${stamp}"
          git push origin "HEAD:${GITHUB_REF_NAME}"
```

Changes from the existing job:
- Added `actions/setup-python@v5` step (needed to run `diff_engine`).
- Added `Run diff engine` step between `Stage snapshot files` and the commit step.
- Renamed `Commit and push snapshots` to `Commit and push snapshots + derived content`.
- The `git add` now stages both `services/data-pipeline/snapshots` AND `content`.
- Commit message now says `data(snapshot+content)`.

- [ ] **Step 3: Verify the YAML is valid**

```bash
cd /c/Users/levin/rateradar
python -c "import yaml; yaml.safe_load(open('.github/workflows/pipeline-cron.yml'))"
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pipeline-cron.yml
git commit -m "ci(cron): run diff engine after snapshot, commit content together"
```

---

## Task 11: Update PRD + ARCHITECTURE docs

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Read both docs to find the right insertion points**

```bash
cd /c/Users/levin/rateradar
head -80 docs/PRD.md
head -80 docs/ARCHITECTURE.md
```

Look for a "Scope" or "Roadmap" section in PRD.md and a "Data flow" or system diagram in ARCHITECTURE.md.

- [ ] **Step 2: Append a "Growth content surfaces" paragraph to PRD.md**

Use your editor to append this to the end of `docs/PRD.md`:

```markdown

## Growth content surfaces (added 2026-05-20)

In addition to the live odds dashboard, the data pipeline emits derived content
for visitor acquisition: a deterministic Daily Brief per cron run, per-meeting
annotated timelines, a market-vs-actual scoreboard, and SVG embed widgets. All
outputs are static files committed to `content/` by the same cron that writes
snapshots — no new runtime cost surface.

Spec: `docs/superpowers/specs/2026-05-20-rateradar-growth-bundle-design.md`.
```

- [ ] **Step 3: Add a paragraph to ARCHITECTURE.md describing the diff engine**

Append to `docs/ARCHITECTURE.md`:

```markdown

## Diff engine (added 2026-05-20)

`services/data-pipeline/src/diff_engine.py` is a pure-Python module with no
network I/O. It runs inside the existing pipeline cron immediately after the
snapshot artifacts are downloaded and before the commit step, reading from
`services/data-pipeline/snapshots/` and the manual `actuals.json`, and writing
derived JSON + SVG to `content/`. Consumers in `apps/web/` read the `content/`
tree using the same git-fallback pattern that `apps/web/src/lib/snapshots.ts`
uses for snapshots.
```

- [ ] **Step 4: Commit**

```bash
git add docs/PRD.md docs/ARCHITECTURE.md
git commit -m "docs: PRD + ARCHITECTURE updates for diff engine"
```

---

## Task 12: Push branch + open PR

**Files:** none new.

- [ ] **Step 1: Push the branch**

```bash
cd /c/Users/levin/rateradar
git push -u origin feat/pr1-diff-engine
```

- [ ] **Step 2: Open a PR via the GitHub REST API**

`gh` isn't installed on this machine — use the API directly with the token from memory `[[github_token]]`:

```bash
curl -s -X POST \
  -H "Authorization: Bearer <PAT-from-memory>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/lawoflarge/rateradar/pulls \
  -d '{
    "title": "feat(pipeline): PR-1 diff engine foundation",
    "head": "feat/pr1-diff-engine",
    "base": "main",
    "body": "## Summary\n- New `services/data-pipeline/src/diff_engine.py` with `compute_brief`, `compute_meeting_timeline`, `compute_scoreboard`, `render_embed_svg`, and a CLI `run()`.\n- Pure-Python, no network I/O, no new external deps.\n- Wired into the existing pipeline cron — produces derived content in `content/` in the same atomic commit as snapshots.\n- 16 pytest tests added (all green locally).\n\n## What this unblocks\n- PR-2: rich meeting pages (consumes `content/meetings/<id>/timeline.json`).\n- PR-3: daily brief + RSS (consumes `content/briefs/<date>.json`).\n- PR-4: embed widget (consumes `content/embed/<id>.svg`).\n- PR-5: scoreboard page (consumes `content/scoreboard.json`).\n\n## Spec\n- `docs/superpowers/specs/2026-05-20-rateradar-growth-bundle-design.md`\n\n## Test plan\n- [ ] Pull the branch, run `cd services/data-pipeline && pytest tests/test_diff_engine.py -v` — expect 16 passed.\n- [ ] Manually trigger `pipeline-cron.yml` via `workflow_dispatch` and confirm the resulting commit contains both snapshot files AND new `content/...` files.\n- [ ] Open one `content/embed/*.svg` in a browser; confirm it renders the Wire Room card with `Powered by RateRadar`.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
  }'
```

Replace `<PAT-from-memory>` with the token from `[[github_token]]`. Capture the `html_url` from the response.

- [ ] **Step 3: Hand off to Levin for review + merge**

Per memory `[[feedback_agent_git_guardrail]]`: do NOT merge yourself. Wait for Levin.

---

## Task 13 (after merge): Verify the cron lights up end-to-end

**Files:** none.

- [ ] **Step 1: After Levin merges, delete the branch locally and remotely**

```bash
cd /c/Users/levin/rateradar
git checkout main
git pull origin main
git branch -d feat/pr1-diff-engine
git push origin --delete feat/pr1-diff-engine
```

(Per `[[feedback_branch_hygiene]]`.)

- [ ] **Step 2: Trigger the cron manually as a smoke test**

```bash
curl -X POST \
  -H "Authorization: Bearer <PAT-from-memory>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/lawoflarge/rateradar/actions/workflows/pipeline-cron.yml/dispatches \
  -d '{"ref": "main"}'
```

- [ ] **Step 3: Wait ~3 minutes, then verify**

```bash
git pull origin main
ls content/briefs/ content/meetings/ content/embed/
cat content/scoreboard.json | python -m json.tool | head -20
```

Expected: a new auto-commit appears with both `services/data-pipeline/snapshots/...` and `content/...` files. The commit message should start with `data(snapshot+content):`.

If the workflow failed, check the Actions tab and fix forward. **Do not** disable the diff engine step on failure — fix the root cause.

- [ ] **Step 4: Update memory**

Edit `C:\Users\levin\.claude\projects\C--Users-levin\memory\project_rateradar.md` to note that PR-1 of the growth bundle has shipped and the `content/` tree is now cron-managed.

- [ ] **Step 5: Tell Levin PR-1 is done, ask whether to start PR-2's plan**

---

## Self-review checklist (filled in by the planner)

1. **Spec coverage.**
   - §3.A1 (Daily Brief): covered by Tasks 4 + 8. Calendar context deferred to PR-3 (course correction noted).
   - §3.A2 (Rich meeting pages): foundation covered by Task 5. Page rendering is PR-2.
   - §3.B1 (Scoreboard): data covered by Task 6. Page rendering is PR-5.
   - §3.B2 (Replay): no PR-1 task — pure web feature, all of PR-5.
   - §3.C1 (Embed): SVG generation covered by Task 7. `/embed` promo page is PR-4.
   - §4 (Cost budget): nothing in PR-1 violates the budget (no LLM, no network calls, no new deps).
   - §5 (Sequencing): PR-1 maps 1:1 to this plan.
2. **Placeholder scan.** No `TBD`, `TODO`, or "fill in later" in the plan body. Every task has the actual code or command.
3. **Type consistency.** `Snapshot`, `SnapshotRow`, `SeriesPoint`, `Actual` dataclasses are defined in Task 3 and referenced consistently in Tasks 4-8. `compute_brief`, `compute_meeting_timeline`, `compute_scoreboard`, `render_embed_svg`, `run`, `main` — all spelled consistently.

---

## Outline of PR-2 through PR-5

Each of these gets its own detailed plan when its predecessor merges. Outlines below establish the scope but do not contain task-level steps.

### PR-2 — A2 Rich meeting pages

**Touches:** `apps/web/src/lib/content.ts` (NEW, mirrors `snapshots.ts` pattern), `apps/web/src/app/meeting/[id]/page.tsx`, `apps/web/src/components/AnnotatedSparkline.tsx` (NEW), `apps/web/src/components/MeetingNarrative.tsx` (NEW), `apps/web/src/components/RelatedMeetings.tsx` (NEW).

**Adds to the meeting page:** sentiment timeline (uses `content/meetings/<id>/timeline.json`), plain-English summary (template), post-meeting block (when `scoreboard.json.history` contains the meeting), related meetings sidebar (same bank, adjacent dates).

**Test plan:** Vitest/Jest component tests + Playwright smoke for a real meeting URL.

**Goes live:** automatically — iOS WebView picks up the change after Vercel redeploy.

### PR-3 — A1 Daily Brief + RSS

**Touches:** `apps/web/src/app/brief/page.tsx` (NEW), `apps/web/src/app/brief/[date]/page.tsx` (NEW), `apps/web/src/app/brief/feed.xml/route.ts` (NEW), `apps/web/src/app/sitemap.ts` (MODIFY), `apps/web/src/components/BriefCard.tsx` (NEW), `apps/web/src/components/MethodologyBadge.tsx` (MODIFY — link to today's brief), `services/data-pipeline/src/diff_engine.py` (MODIFY — add FRED release-calendar lookup to populate `calendar_context`).

**FRED setup:** add `FRED_API_KEY` to repo secrets, add `requests` (or `httpx`) usage in `diff_engine.py`, add tests with mocked FRED responses.

**Test plan:** snapshot tests for the brief page at a fixture date, RSS feed validation.

### PR-4 — C1 Embed widget + `/embed` promo

**Touches:** `apps/web/src/app/embed/page.tsx` (NEW — promo), `apps/web/src/app/embed/[id]/page.tsx` (NEW — iframe HTML), `apps/web/src/app/embed/[id].svg/route.ts` (NEW — SVG passthrough with cache headers), `apps/web/src/components/EmbedSnippet.tsx` (NEW).

**Cache headers:** `public, max-age=300, s-maxage=300, stale-while-revalidate=86400`.

**Test plan:** E2E test that embeds an iframe in a fixture page and asserts rendering; manual check that the SVG works as an `<img>` from a third-party domain (CSP, content-type).

### PR-5 — B1 Scoreboard + B2 interactive replay

**Touches:** `apps/web/src/app/scoreboard/page.tsx` (NEW), `apps/web/src/components/ScoreboardTable.tsx` (NEW), `apps/web/src/components/ReplayScrubber.tsx` (NEW), `apps/web/src/app/meeting/[id]/page.tsx` (MODIFY — wire in the scrubber).

**Replay UX:** slider under the historical chart drives a state on the chart; "play" animates the slider from day −60 to today over ~5 seconds.

**Test plan:** Playwright interaction test: scrub mid-history, assert the chart redraws to the right values; press play, assert the scrubber moves end-to-end.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-rateradar-growth-bundle.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
