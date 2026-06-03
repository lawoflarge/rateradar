# RateRadar — Autonomous Overnight Run (Engine Fix Phases 2–5)

**Run started:** 2026-06-03 (overnight, autonomous)
**Baseline:** main @ `7a4f25e` (Phase 1 merged via PR #13), 76 pipeline tests green.

This file is the morning hand-off. Per phase: PR#/commit + verify output, or the exact blocker + resume command.

---

## Phase 1 — FED §10 cross-contract solve — ✅ DONE (pre-run)
PR #13, commit `7a4f25e`, METHODOLOGY v1.1.0. Not part of this run.

## Phase 2 — ECB free spot-anchored fetcher — ✅ MERGED (PR #14, squash `57982a3`)
Branch: `feat/ecb-spot-anchored` (9 commits) — merged + deleted. CI green.

**Shipped:** `EcbEstrFetcher` (`src/fetchers/ecb_estr_source.py`) — free no-auth ECB fetcher pulling real DFR + €STR spot from the ECB Data Portal (`data-api.ecb.europa.eu`) with FRED CSV fallback, anchoring every meeting at the current DFR (flat "Hold") and labeling it "spot-anchored — forward odds unavailable". Wired into `build_fetcher` as `--source estr`; basis surfaced in CLI + JSON payload (`estimation_basis`) + METHODOLOGY §6/§11; METHODOLOGY_VERSION 1.1.0→1.2.0. `probability_calc.py` untouched (pure).

**Verify output:**
- Full suite: `99 passed` (was 76; +23 new). black clean on all touched files; ruff clean on new files (json_writer pre-existing UP035/S112 left out-of-scope per directive).
- Live `--source estr --bank ecb`: every meeting 100% Hold @ 2.000%, `Estimation basis: spot-anchored — forward odds unavailable`, no fallback warning.
- Live data confirmed real (not fallback): DFR 2.0% + €STR spot 1.931% fetched from ECB Data Portal.
- JSON snapshot carries `"estimation_basis"`; FED mock path still works.
- Reviews: Group A spec✅+quality✅, Group B spec✅+quality✅(conditional, fixed), final holistic review = **SHIP**.
- Note: `estr_spot()` + `forward_curve_available()` are intentional public hooks for future UI wiring (not dead code).

## Phase 3 — Pipeline off mock + real daily data — ✅ MERGED (PR #15, squash `d85cee9`) + LIVE CRON CONFIRMED
Branch: `feat/pipeline-real-data` (7 commits) — merged + deleted. CI green.

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

**Live cron — DONE:** triggered `pipeline-cron.yml` on main; run succeeded and committed REAL data (`f848269`, "pipeline cron @ 2026-06-02T23:11Z"). FED `fed/latest.json` = 25 rows / 5 meetings, `methodology_version 1.2.0`, basis forward-implied, smooth Hold 98/90/79/87/68% (no sawtooth); ECB spot-anchored labeled. yfinance was NOT rate-limited on the GH runner this run. ≥1 real FED snapshot landed → Phase 4 unblocked.

## Phase 4 — Screenshots from real data — ✅ CODE MERGED (PR #16, `e81ea13`); ⏳ UPLOAD pending issuer
Branch merged + deleted (user approved 2026-06-03). The 15 real screenshots + the live Fed-rate fix are on `main`. The ASC **upload** still needs `ASC_ISSUER_ID` (see below).

**What shipped (committed on branch):**
- Committed the previously-untracked `capture-d1-posters.mjs` generator.
- **15 real-data D1 screenshots** generated + staged in `apps/ios-expo/assets/screenshots/{6.9,6.5,ipad-13}/` (5 shots × 3 sizes): `01-hero, 02-outcomes, 03-path, 04-divergence, 05-curve`. Exact Apple dims: **6.9=1290×2796, 6.5=1242×2688, ipad-13=2064×2752**. Visually verified all show REAL data (FED forward-implied @ 3.625, methodology v1.2.0, smooth no-sawtooth Hold 98/90/79/87/68%; ECB spot-anchored; hero badge shows "METHODOLOGY V1.2.0").
- **2 bug fixes found while rendering** (both committed, both improve the live product):
  - `fix(ios)` `41828bd`: generator rendered posters at dpr-3 → 3870×8388 (3× too big). Now renders posters in a dpr-1 context → exact Apple dims.
  - `fix(web)` `ff1771e`: `policy-rates.ts` had a **stale hardcoded Fed anchor 4.375** → the implied-rate curve + displayed current rate were +0.75pp wrong vs real outcome data. Corrected to **3.625** (real Fed mid since 2026-04-29). This is a genuine LIVE-SITE display bug fix.
  - `fix(ios)` `4561c67`: both ASC uploaders had a broken `AuthKey_<ASC_KEY_ID>.p8` placeholder path (public-repo sanitization artifact). Now interpolate `${process.env.ASC_KEY_ID}` → runnable.

**🚫 BLOCKER — ASC upload cannot run unattended:** `ASC_ISSUER_ID` is not set in the environment or repo (it is a credential; I did not hunt the filesystem for it). The uploaders build a JWT with `iss: ASC_ISSUER_ID` → without it the ASC API returns 401. Per the Phase-4 hard-stop ("upload fails unattended → STAGE + record resume + HALT before Phase 5"), I staged the images and stopped.

**▶️ RESUME (morning) — upload the staged screenshots, then proceed to Phase 5:**
```bash
# 1) merge the Phase 4 PR (after a glance — it includes the live policy-rate fix + 15 screenshots)
gh pr merge <PR#> --squash --delete-branch

# 2) upload the staged screenshots (the ONLY missing piece is your ASC issuer UUID):
cd ~/Data/Claude/rateradar/apps/ios-expo
export ASC_KEY_ID=8XWLD2B2RQ
export ASC_ISSUER_ID=<your App Store Connect issuer UUID>
ASC_SCREENSHOT_FILES="01-hero.png,02-outcomes.png,03-path.png,04-divergence.png,05-curve.png" \
  node scripts/asc-upload-screenshots.mjs        # iPhone 6.9 + 6.5
node scripts/asc-ipad-screenshots.mjs            # iPad (see note)
```
- **iPad note:** staged `ipad-13/*` are 2064×2752 (iPad Pro 13" M4). `asc-ipad-screenshots.mjs` self-captures 2048×2732 for `APP_IPAD_PRO_3GEN_129` (12.9") — it does NOT read the staged 2064×2752 files. Reconcile the iPad display type before uploading (either point it at the staged 2064×2752 with the matching display type, or let it self-capture 2048×2732).
- Re-render anytime: real data is live on main; run a local web build (Supabase env empty → JSON) and `RR_BASE_URL=http://localhost:<port> node scripts/capture-d1-posters.mjs`.

## Phase 5 — ASO metadata + DE localization + ship v1.0.3 — ✍️ CONTENT DRAFTED, submission pending issuer
**All copy is written + char-checked + committed** to `apps/ios-expo/ASO-v1_0_3.md` (EN + DE subtitle/keywords/description, in-app event for FOMC 2026-06-17 / ECB 2026-06-11). "ECB" visible everywhere; hidden "ezb" only in the DE keyword field. The only thing left is the ASC push, which needs `ASC_ISSUER_ID`:
```bash
cd ~/Data/Claude/rateradar/apps/ios-expo
export ASC_KEY_ID=8XWLD2B2RQ ASC_ISSUER_ID=<issuer UUID>
node scripts/asc-fill-metadata.mjs        # push EN+DE metadata from ASO-v1_0_3.md, create v1.0.3 (reuse build 4)
node scripts/asc-finalize-submission.mjs  # set MANUAL release (NOT auto)
node scripts/asc-submit-for-review.mjs    # submit (only after screenshots uploaded)
```

---

## Items awaiting a human — ONLY ONE THING LEFT
**Provide `ASC_ISSUER_ID`** (your App Store Connect issuer UUID). It is the *single* remaining blocker — it gates the screenshot upload AND the v1.0.3 submission (both use the ASC REST API, whose JWT needs `iss: <issuer>`). It is a credential not present in env/repo; I did not hunt the filesystem for it. Everything else is done + merged + drafted:
- ✅ Phases 2+3 merged, live cron committing real data.
- ✅ Phase 4 code merged (`e81ea13`): 15 real screenshots staged in `apps/ios-expo/assets/screenshots/`, live Fed-rate fix.
- ✅ Phase 5 ASO/DE copy fully drafted in `apps/ios-expo/ASO-v1_0_3.md`.

**To finish (≈2 min once you have the UUID):**
```bash
cd ~/Data/Claude/rateradar/apps/ios-expo
export ASC_KEY_ID=8XWLD2B2RQ ASC_ISSUER_ID=<issuer UUID>
ASC_SCREENSHOT_FILES="01-hero.png,02-outcomes.png,03-path.png,04-divergence.png,05-curve.png" \
  node scripts/asc-upload-screenshots.mjs   # iPhone 6.9 + 6.5
node scripts/asc-ipad-screenshots.mjs       # iPad (reconcile display type, see Phase 4 note)
node scripts/asc-fill-metadata.mjs && node scripts/asc-finalize-submission.mjs && node scripts/asc-submit-for-review.mjs
```
Or just paste the UUID back into this chat and I'll run all of it.
