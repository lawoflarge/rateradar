# Phase 3 — Pipeline off Mock + Real Daily Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Switch the cron pipeline off `--source mock` (FED → real `yfinance`, ECB → `estr` spot-anchored) with a dynamic current-rate, never clobber a good committed JSON snapshot with an empty/failed run, fix the dormant `methodology_version` default, and make `/api/status` distinguish "Supabase paused but healthy" from a real outage.

**Architecture:** Production reads the git-committed JSON snapshots (Supabase is paused). The cron must therefore write REAL, day-varying snapshots. yfinance rate-limits from CI, so an empty fetch must preserve the last good committed JSON (skip the write) rather than overwrite it. FED needs a current-rate that won't go stale → read it from a GitHub repo variable. The probability math is unchanged (no methodology bump).

**Tech Stack:** Python 3.11 (pipeline), GitHub Actions YAML (cron), Next.js/TypeScript (web status route).

**Working dir for python commands:** `services/data-pipeline` via `.venv/bin/python`. **Web:** `apps/web` via `pnpm`.

**Confirmed pre-work (already verified):** A local real FED run `python -m src.main --bank fed --year 2026 --source yfinance --current-rate 3.625` yields smooth distributions across 5 upcoming FOMC meetings (Hold 95/89/74/92/70%) with NO 100% sawtooth — the §10 fix holds with real data. ECB `--source estr` yields the labeled spot-anchored flat Hold.

---

## File structure

- **Modify** `src/json_writer.py` — make `methodology_version` a REQUIRED param (drop the stale `"1.0.0"` default).
- **Modify** `src/main.py` — `has_publishable_rows()` guard (skip snapshot write on empty results → preserve last-good); harden `resolve_current_rate` against an empty-string env var.
- **Modify** `tests/test_json_writer.py` — pass `methodology_version` at the call sites that omitted it.
- **Modify** `tests/test_main_current_rate.py` — empty-env case.
- **Create** `tests/test_main_snapshot_guard.py` — keep-last-good integration test.
- **Modify** `.github/workflows/pipeline-cron.yml` — FED→yfinance / ECB→estr + `RR_FED_CURRENT_RATE` from repo variable. *(Done by the controller, not a subagent task — listed here for completeness.)*
- **Modify** `apps/web/src/app/api/status/route.ts` — paused-vs-healthy via `loadJsonSnapshotAt`.

> **Out of scope:** `probability_calc.py` (pure, untouched), `fed_fetcher.py` / `ecb_estr_source.py` math, METHODOLOGY.md (no math change → no version bump), the pre-existing `json_writer.py` ruff debt (UP035/S112 — leave it).

---

## Task 1: Make `methodology_version` a required param of `write_snapshot_files`

**Files:**
- Modify: `src/json_writer.py`
- Modify: `tests/test_json_writer.py`

**Why:** The `"1.0.0"` default is a stale-data trap (Phase-1 follow-up). The only production caller (`main.py`) already passes the live `METHODOLOGY_VERSION`; making the param required guarantees no snapshot is ever silently stamped `1.0.0`.

- [ ] **Step 1: Update the failing call sites in `tests/test_json_writer.py` FIRST**

Find every `write_snapshot_files(...)` call in `tests/test_json_writer.py` that does NOT pass `methodology_version=` and add `methodology_version="1.2.0"` to it (e.g. the `test_snapshot_payload_includes_estimation_basis` call and any others). Run `.venv/bin/python -m pytest tests/test_json_writer.py -q` and confirm they still pass.

- [ ] **Step 2: Add a test asserting the param is required**

```python
# append to tests/test_json_writer.py
def test_methodology_version_is_required(tmp_path: Path) -> None:
    with pytest.raises(TypeError):
        write_snapshot_files(
            snapshot_dir=tmp_path,
            bank_code="FED",
            probabilities=[],
        )  # type: ignore[call-arg]
```
(Ensure `pytest` and `Path` are imported at the top of the file — they already are.)

- [ ] **Step 3: Run it to verify it FAILS**

Run: `.venv/bin/python -m pytest tests/test_json_writer.py::test_methodology_version_is_required -q`
Expected: FAIL (the default currently makes the call succeed, so no `TypeError`).

- [ ] **Step 4: Make the param required in `src/json_writer.py`**

Change the signature — remove the default from `methodology_version`, keeping `estimation_basis` optional after it:

```python
def write_snapshot_files(
    snapshot_dir: Path,
    bank_code: str,
    probabilities: Iterable,
    methodology_version: str,
    snapshot_at: datetime | None = None,
    estimation_basis: str | None = None,
) -> tuple[Path, Path]:
```

> NOTE: `methodology_version` moves BEFORE the optional `snapshot_at`/`estimation_basis` because a required param cannot follow a defaulted one. Update the docstring's arg order if it lists them.

- [ ] **Step 5: Verify the `main.py` caller still matches**

In `src/main.py` the `write_snapshot_files(...)` call uses keyword args, so arg-order is irrelevant — but confirm by reading it that it passes `methodology_version=METHODOLOGY_VERSION` and `estimation_basis=basis`. No change needed if all args are keyword.

- [ ] **Step 6: Run the full suite + lint**

Run: `.venv/bin/python -m pytest -q && .venv/bin/black --check src/json_writer.py tests/test_json_writer.py`
Expected: all PASS; black clean. (ruff on json_writer will still show the PRE-EXISTING UP035/S112 — leave them, out of scope.)

- [ ] **Step 7: Commit**

```bash
git add src/json_writer.py tests/test_json_writer.py
git commit -m "fix(pipeline): require methodology_version in write_snapshot_files (no stale 1.0.0)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Keep-last-good guard — never write an empty snapshot

**Files:**
- Modify: `src/main.py`
- Create: `tests/test_main_snapshot_guard.py`

**Why:** yfinance rate-limits from CI. An empty fetch → empty `results` → writing it would clobber the last good committed `latest.json`/`series.json`. The guard skips the write and logs loudly, preserving the last good data (the cron's commit step then sees no diff).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_main_snapshot_guard.py
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
        ["main", "--bank", "fed", "--current-rate", "3.625",
         "--json-snapshot-dir", str(tmp_path)],
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
        ["main", "--bank", "fed", "--current-rate", "3.625",
         "--json-snapshot-dir", str(tmp_path)],
    )
    rc = main_mod.main()
    assert rc == 0
    assert (tmp_path / "fed" / "latest.json").exists()  # real data IS written
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_main_snapshot_guard.py -q`
Expected: FAIL (`ImportError: cannot import name 'has_publishable_rows'`).

- [ ] **Step 3: Add the guard to `src/main.py`**

Add the helper near the other module-level helpers (e.g. after `estimation_basis_for`):

```python
def has_publishable_rows(results: list) -> bool:
    """True if the computed batch is non-empty and safe to persist.

    An empty batch means the fetch failed or rate-limited (e.g. yfinance from a
    CI IP). Writing it would clobber the last good committed JSON snapshot, so
    the caller must skip the write and keep the previous data.
    """
    return len(results) > 0
```

Then guard the snapshot-write block in `main()`:

```python
    if args.json_snapshot_dir is not None:
        if not has_publishable_rows(results):
            logger.warning(
                "Computed 0 rows (fetch failed or rate-limited) — SKIPPING snapshot "
                "write to preserve the last good committed JSON snapshot."
            )
            print(
                "\n[snapshot write skipped: 0 rows computed — last good JSON preserved]",
                file=sys.stderr,
            )
        else:
            latest, history = write_snapshot_files(
                snapshot_dir=args.json_snapshot_dir,
                bank_code=args.bank.upper(),
                probabilities=results,
                methodology_version=METHODOLOGY_VERSION,
                snapshot_at=started_at,
                estimation_basis=basis,
            )
            print(f"\nWrote JSON snapshot: {latest}")
            print(f"Appended history:    {history}")
```

(All kwargs → order-free; matches Task 1's new signature.)

- [ ] **Step 4: Run to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_main_snapshot_guard.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + lint**

Run: `.venv/bin/python -m pytest -q && .venv/bin/black --check src/main.py tests/test_main_snapshot_guard.py && .venv/bin/ruff check src/main.py tests/test_main_snapshot_guard.py`
Expected: all PASS; ruff clean.

- [ ] **Step 6: Commit**

```bash
git add src/main.py tests/test_main_snapshot_guard.py
git commit -m "feat(pipeline): keep-last-good guard — skip snapshot write on empty fetch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Harden `resolve_current_rate` against an empty-string env var

**Files:**
- Modify: `src/main.py`
- Modify: `tests/test_main_current_rate.py`

**Why:** The cron passes `RR_FED_CURRENT_RATE: ${{ vars.RR_FED_CURRENT_RATE }}`. If that repo variable is ever unset, GitHub renders it as `""`, and the current code does `float("")` → `ValueError` crash. Treat empty/whitespace as "missing" so FED falls through to the clear `SystemExit(2)` guidance instead.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_main_current_rate.py
def test_fed_current_rate_empty_env_treated_as_missing():
    # An unset GitHub repo variable renders as "" — must not crash on float("").
    with pytest.raises(SystemExit):
        resolve_current_rate(bank="fed", cli_value=None, env="")
    with pytest.raises(SystemExit):
        resolve_current_rate(bank="fed", cli_value=None, env="   ")
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_main_current_rate.py::test_fed_current_rate_empty_env_treated_as_missing -q`
Expected: FAIL with `ValueError: could not convert string to float: ''`.

- [ ] **Step 3: Harden `resolve_current_rate` in `src/main.py`**

Change the FED env branch from `if env is not None:` to require a non-blank value:

```python
    if bank == "fed":
        if env is not None and env.strip():
            return float(env.strip())
        print(
            "[--current-rate is required for FED (no stale default). Pass "
            "--current-rate 3.625 or set RR_FED_CURRENT_RATE. Real Fed mid is "
            "3.625 / range 3.50-3.75 since 2026-04-29.]",
            file=sys.stderr,
        )
        raise SystemExit(2)
```

- [ ] **Step 4: Run to verify it passes (existing 5 tests still pass)**

Run: `.venv/bin/python -m pytest tests/test_main_current_rate.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Full suite + lint**

Run: `.venv/bin/python -m pytest -q && .venv/bin/black --check src/main.py tests/test_main_current_rate.py && .venv/bin/ruff check src/main.py tests/test_main_current_rate.py`
Expected: all PASS; ruff clean.

- [ ] **Step 6: Commit**

```bash
git add src/main.py tests/test_main_current_rate.py
git commit -m "fix(pipeline): treat empty RR_FED_CURRENT_RATE env as missing (no float crash)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `/api/status` distinguishes paused vs healthy

**Files:**
- Modify: `apps/web/src/app/api/status/route.ts`

**Why:** Prod's real data source is the committed JSON snapshots; Supabase is paused. Today the route probes only Supabase and returns `ok:false`/503 when it's paused — falsely reporting an outage. The route must report the JSON snapshot health (the real source) and treat Supabase-paused as an informational, expected state.

**Working dir:** `apps/web`. Use the existing helper `loadJsonSnapshotAt(bank)` from `@/lib/snapshots` (returns `{ at, version } | null`).

- [ ] **Step 1: Read the current route + the helper**

Read `apps/web/src/app/api/status/route.ts` and `apps/web/src/lib/snapshots.ts` (`loadJsonSnapshotAt`). Note the existing `Status` interface and the Supabase probe.

- [ ] **Step 2: Add a `snapshots` health block + reclassify Supabase paused**

Extend the route so the response includes JSON snapshot freshness for both banks and treats a paused/unreachable Supabase as healthy-via-JSON:
- Import `loadJsonSnapshotAt` from `@/lib/snapshots`.
- `const [fedSnap, ecbSnap] = await Promise.all([loadJsonSnapshotAt("FED"), loadJsonSnapshotAt("ECB")]);`
- Add to the `Status` interface:
  ```ts
  snapshots?: {
    fed: { at: string; version: string | null } | null;
    ecb: { at: string; version: string | null } | null;
  };
  data_source: "supabase" | "json_snapshots" | "none";
  ```
- `const haveJson = Boolean(fedSnap || ecbSnap);`
- In the `missing_env` branch and the Supabase `catch` (paused/error) branch: include the `snapshots` block, set `ok: haveJson`, `data_source: haveJson ? "json_snapshots" : "none"`, and (in `missing_env`) set `supabase: "missing_env"` as today. Crucially: when Supabase is unreachable but JSON snapshots exist, return **HTTP 200** with `ok: true` (NOT 503) — that is the true production state. Only return 503 when `!haveJson`.
- In the healthy-Supabase branch: set `data_source: "supabase"` and still include the `snapshots` block.

The key behavioral change: **JSON snapshots present ⇒ `ok: true`, HTTP 200, `data_source: "json_snapshots"` even when Supabase is paused/missing.**

- [ ] **Step 3: Lint + build (the web CI gate)**

Run (from `apps/web`): `pnpm lint && pnpm build`
Expected: lint clean, build succeeds (no type errors). The build runs without Supabase env — confirm the route compiles and the JSON path is exercised.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/status/route.ts
git commit -m "feat(web): /api/status reports JSON-snapshot health, paused != outage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 (controller-run): cron YAML + repo variable + VERIFY

> Executed by the controller (infra config + live cron trigger), not a TDD subagent.

- [ ] **Cron YAML** — `.github/workflows/pipeline-cron.yml`: replace `matrix: bank: [fed, ecb]` + hardcoded `--source mock` with a per-bank source (FED→`yfinance`, ECB→`estr`) and add `RR_FED_CURRENT_RATE: ${{ vars.RR_FED_CURRENT_RATE }}` to the run step env. ECB ignores the rate (uses live DFR).
- [ ] **Repo variable** — `gh variable set RR_FED_CURRENT_RATE --body "3.625"`.
- [ ] **VERIFY (local)** — real FED + ECB runs print plausible, labeled, no-sawtooth output; full suite green; black/ruff clean on touched files.
- [ ] **CI + merge**, then **trigger the live cron once** (`gh workflow run pipeline-cron.yml`), wait, confirm it committed a REAL, varying `series.json` (not mock/empty). Retry up to 3× on yfinance rate-limit; if still failing, record in NIGHT-REPORT and proceed only if ≥1 real FED snapshot landed.

---

## Self-review (spec coverage)

- Cron off mock (FED yfinance, ECB estr, dynamic rate from repo var) — Task 5 (controller).
- Keep-last-good (never overwrite good JSON with empty) — Task 2.
- `json_writer.py:42` methodology_version default fixed (now required) — Task 1.
- Defensive log/flag (skip-write warning + existing per-meeting skip warnings); `/api/status` paused-vs-healthy — Task 4.
- VERIFY local + live cron — Task 5.
- `probability_calc.py` untouched; no methodology bump (no math change).
