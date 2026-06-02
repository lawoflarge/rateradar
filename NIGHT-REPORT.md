# RateRadar — Autonomous Overnight Run (Engine Fix Phases 2–5)

**Run started:** 2026-06-03 (overnight, autonomous)
**Baseline:** main @ `7a4f25e` (Phase 1 merged via PR #13), 76 pipeline tests green.

This file is the morning hand-off. Per phase: PR#/commit + verify output, or the exact blocker + resume command.

---

## Phase 1 — FED §10 cross-contract solve — ✅ DONE (pre-run)
PR #13, commit `7a4f25e`, METHODOLOGY v1.1.0. Not part of this run.

## Phase 2 — ECB free spot-anchored fetcher — ✅ VERIFIED, awaiting CI+merge
Branch: `feat/ecb-spot-anchored` (9 commits: `65885c4`→`d681445`).

**Shipped:** `EcbEstrFetcher` (`src/fetchers/ecb_estr_source.py`) — free no-auth ECB fetcher pulling real DFR + €STR spot from the ECB Data Portal (`data-api.ecb.europa.eu`) with FRED CSV fallback, anchoring every meeting at the current DFR (flat "Hold") and labeling it "spot-anchored — forward odds unavailable". Wired into `build_fetcher` as `--source estr`; basis surfaced in CLI + JSON payload (`estimation_basis`) + METHODOLOGY §6/§11; METHODOLOGY_VERSION 1.1.0→1.2.0. `probability_calc.py` untouched (pure).

**Verify output:**
- Full suite: `99 passed` (was 76; +23 new). black clean on all touched files; ruff clean on new files (json_writer pre-existing UP035/S112 left out-of-scope per directive).
- Live `--source estr --bank ecb`: every meeting 100% Hold @ 2.000%, `Estimation basis: spot-anchored — forward odds unavailable`, no fallback warning.
- Live data confirmed real (not fallback): DFR 2.0% + €STR spot 1.931% fetched from ECB Data Portal.
- JSON snapshot carries `"estimation_basis"`; FED mock path still works.
- Reviews: Group A spec✅+quality✅, Group B spec✅+quality✅(conditional, fixed), final holistic review = **SHIP**.
- Note: `estr_spot()` + `forward_curve_available()` are intentional public hooks for future UI wiring (not dead code).

## Phase 3 — Pipeline off mock + real daily data — ✅ VERIFIED, awaiting CI+merge+live-cron
Branch: `feat/pipeline-real-data` (7 commits: `fc28314`→`8cb6b3e`).

**Shipped:**
- **Cron off mock** (`pipeline-cron.yml`): matrix now FED→`yfinance`, ECB→`estr`; `RR_FED_CURRENT_RATE` read from a **repo variable** (set to `3.625`, not hardcoded). ECB ignores it (live DFR).
- **Keep-last-good guard** (`main.py` `has_publishable_rows`): an empty/rate-limited fetch SKIPS the snapshot write (logs + stderr notice) so the last good committed JSON is never clobbered; run stays green.
- **`methodology_version` now required** in `write_snapshot_files` (no stale `1.0.0` default — Phase-1 follow-up closed).
- **`resolve_current_rate` hardened**: empty `RR_FED_CURRENT_RATE` ("") treated as missing → clean exit, not a `float("")` crash.
- **`/api/status` paused-vs-healthy**: reports JSON-snapshot health for FED+ECB via `loadJsonSnapshotAt`; JSON present ⇒ `ok:true`/HTTP 200/`data_source:"json_snapshots"` even when Supabase is paused; 503 only when neither source exists.

**Verify output (local):**
- Full suite `104 passed` (was 99; +5). black clean on touched files; ruff clean (json_writer pre-existing debt left out-of-scope).
- Real FED `--source yfinance --current-rate 3.625 --json-snapshot-dir`: **25 rows / 5 upcoming meetings** (2026-06-17→12-09), `methodology_version:1.2.0`, basis `forward-implied (Fed Funds futures via yfinance)`, **no sawtooth** (smooth Hold 95/89/74/92/70%). Past/expired contracts correctly skipped.
- Real ECB `--source estr`: flat 100% Hold @ 2.000%, basis `spot-anchored — forward odds unavailable`.
- Web: `pnpm lint` clean + `pnpm build` exit 0.
- Reviews: Group A (pipeline) spec✅+quality✅(approve); Group B (web) spec+quality✅ = SHIP.

**Remaining after merge:** trigger live cron (`gh workflow run pipeline-cron.yml`) + confirm a real, varying `series.json` committed (retry ≤3× on yfinance rate-limit; proceed to Phase 4 only if ≥1 real FED snapshot landed).

## Phase 4 — Screenshots from real data — ⬜ PENDING
Branch: `feat/d1-screenshots-real`

## Phase 5 — ASO metadata + DE localization + ship v1.0.3 — ⬜ PENDING
Branch: `feat/aso-v1_0_3`

---

## Items awaiting a human
_(none yet)_
