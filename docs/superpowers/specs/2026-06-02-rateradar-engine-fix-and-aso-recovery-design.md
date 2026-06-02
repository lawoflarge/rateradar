# RateRadar — Engine Fix + ASO Recovery
**Design / spec — 2026-06-02**

## Origin
Started as an ASO "tap-through recovery": App Store impression→product-page-view fell 14.5%→5.0%. Most likely a **denominator effect** (an ECB/FOMC-run-up spike of low-intent impressions), not necessarily a creative regression. While building new screenshots the investigation uncovered a deeper problem; by decision the scope was widened to a full data-engine fix.

## Discovered reality (root causes)
- **Prod serves MOCK data.** Cron `.github/workflows/pipeline-cron.yml:63` hardcoded `--source mock` → `services/data-pipeline/src/fetchers/mock_source.py` constant `DEFAULT_PRICES` → identical probabilities every run (flat history) **and** degenerate later-meeting distributions (100% on alternating ±50bp).
- **Supabase paused** (`nzuovghfjxnbnraxxkej`, free tier, no free slot → DNS NXDOMAIN). Read path `apps/web/src/lib/data.ts` `getMeetingHistory` silently falls back to the flat committed JSON via GitHub raw (`apps/web/src/lib/snapshots.ts`). Real seed history (`scripts/seed_history.py`) is stranded in the paused DB. ⇒ **Prod = committed JSON; make THAT real, Supabase not needed.**
- **Real FED data works free** (no code change to test): `python -m src.main --bank fed --year 2026 --source yfinance --current-rate 3.625`. Nearest meeting plausible. The `--current-rate` default 4.375 is **stale** — real Fed range 3.50–3.75% (mid 3.625) since 2026-04-29.
- **Methodology §10 limitation** (`docs/METHODOLOGY.md` §10; `fed_fetcher.py:88-146` `solve_post_meeting_rate`): the single-contract solve divides by the tiny post-meeting weight for late-month meetings → a ~1bp gap explodes into multi-hundred-bp swings and chains forward ⇒ **multi-meeting FED is garbage even with real data.**
- **ECB has NO free forward-implied source.** Free = spot €STR + DFR only (ECB Data Portal `data-api.ecb.europa.eu`; FRED `ECBESTRVOLWGTTRMDMNRT`). Real forward (€STR OIS / FEU3 Euribor futures) = paid (Barchart/ICE/BlueGamma) or scraping.

## Hard constraints
- **NEVER pay for data feeds — free sources only.** [Levin, 2026-06-02]
- No scraping. [CLAUDE.md]
- Probability math stays pure + mandatory unit tests; methodology changes update `METHODOLOGY.md` + bump version. [CLAUDE.md]
- Keep "ECB" visible everywhere (English is fine); German listing localization; hidden "ezb" only in the DE keyword field. [Levin]
- Historical tracking is the differentiator — must become real (no fabrication).

## Goals / success criteria
1. Prod off `--source mock`: real FED forward probabilities; ECB honestly spot-anchored.
2. Multi-meeting FED correct (no degenerate 100% sawtooths) — §10 fixed, proven by tests.
3. Cron commits real, day-varying `series.json` → real history accumulates.
4. D1 screenshots re-rendered from real data; history shot returns once data varies.
5. ASO metadata + German listing + in-app event shipped → new App Store version (v1.0.3).

## Phases

### Phase 1 — FED methodology §10 rewrite (free yfinance) — START HERE (fresh session, TDD)
- Cross-contract solve to isolate each meeting's post-meeting rate (front + back month contracts spanning the meeting) instead of the single-contract solve. Un-solvable meetings → flag/skip, never emit garbage.
- TDD: regression tests first — incl. a §10 late-month case (Jul-29-style) and a chained-meeting case. Keep `probability_calc.py` pure.
- Update `docs/METHODOLOGY.md` §10 + bump methodology version.
- Fix the stale `--current-rate` default → dynamic (derive current Fed target midpoint, or pass via CI env).
- **Verify:** a real yfinance run yields smooth, plausible distributions across ALL upcoming FOMC meetings (no 100% alternating).

### Phase 2 — ECB free spot-anchored fetcher
- New `EcbEstrFetcher` via ECB Data Portal (no auth): DFR (current rate) + €STR spot. Free only.
- Best-effort: check whether any free source (e.g. yfinance Euro STIR / Euribor futures) gives more than spot; if not, spot-anchored.
- Output **explicitly labeled** "spot-anchored — forward odds unavailable" (UI + methodology). Honest, not misleading.
- Tests + METHODOLOGY note.

### Phase 3 — Pipeline off mock + real daily data
- `.github/workflows/pipeline-cron.yml`: `--source yfinance` (FED) + ECB free fetcher; dynamic current-rate; remove hardcoded `mock`.
- Cron commits real `series.json` (`json_writer.py`) → real history accumulates day over day.
- Defensive: log/flag when the JSON fallback fires or a solved rate diverges beyond a threshold; `/api/status` distinguishes paused vs healthy. Never overwrite a good committed JSON with an empty/failed run.
- **Verify:** a real cron run commits varying, plausible FED + honestly-labeled ECB data.

### Phase 4 — Screenshots from real data
- Re-render via `apps/ios-expo/scripts/capture-d1-posters.mjs` once real data flows.
- D1 set (approved direction: cream `#F5F1E8` / IBM Plex Serif / amber `#C8841C`; real app UI framed + on-brand caption): hero · outcomes · most-likely-path · Fed-vs-ECB divergence · implied curve. Sizes 6.9" / 6.5" / iPad-13. History shot returns once enough real history accumulates.
- Upload via `asc-upload-screenshots.mjs` + `asc-ipad-screenshots.mjs`.

### Phase 5 — ASO metadata + localization + in-app event + ship
- Metadata (keep "ECB" visible; may lean on real history again): subtitle + 100-char keyword field (singular, comma-no-space, no title/subtitle dupes). Title `RateRadar: Fed & ECB` unchanged.
- German (de) listing localization: ECB visible, hidden `ezb` in the DE keyword field, translated description.
- In-app event for the next FOMC/ECB decision.
- New App Store version v1.0.3 (reuse build 4 if no native change), submit via `asc-fill-metadata.mjs` → `asc-finalize-submission.mjs` → `asc-submit-for-review.mjs`.

## Risks / open
- §10 cross-contract correctness — careful tests; prefer skip/flag over emitting implausible numbers.
- ECB spot-anchored is low-information (near-flat); accepted per free-only + honest labeling — ECB "history" will be near-flat.
- yfinance reliability in CI (rate limits) — add retries/fallback; on failure keep the last good committed JSON.

## Key files
- Pipeline: `services/data-pipeline/src/main.py`, `fed_fetcher.py:88-146`, `probability_calc.py`, `fetchers/yfinance_source.py`, `fetchers/mock_source.py`, `ecb_fetcher.py`, `json_writer.py`, `.github/workflows/pipeline-cron.yml`, `docs/METHODOLOGY.md` §10.
- Web read path: `apps/web/src/lib/data.ts`, `apps/web/src/lib/snapshots.ts`, `apps/web/src/app/api/status/route.ts`.
- Screenshots/ASO: `apps/ios-expo/scripts/capture-d1-posters.mjs`, `apps/ios-expo/scripts/asc-*.mjs`; ASC app `6768628917`; key `apps/ios-expo/.secrets/AuthKey_8XWLD2B2RQ.p8`.

## Repro: real FED run
```
cd services/data-pipeline
/opt/homebrew/bin/python3.11 -m venv .venv          # system py 3.9 too old; need >=3.11
.venv/bin/pip install yfinance pandas numpy pyyaml requests tenacity
.venv/bin/python -m src.main --bank fed --year 2026 --source yfinance --current-rate 3.625
```
