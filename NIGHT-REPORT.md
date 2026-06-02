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

## Phase 3 — Pipeline off mock + real daily data — ⬜ PENDING
Branch: `feat/pipeline-real-data`

## Phase 4 — Screenshots from real data — ⬜ PENDING
Branch: `feat/d1-screenshots-real`

## Phase 5 — ASO metadata + DE localization + ship v1.0.3 — ⬜ PENDING
Branch: `feat/aso-v1_0_3`

---

## Items awaiting a human
_(none yet)_
