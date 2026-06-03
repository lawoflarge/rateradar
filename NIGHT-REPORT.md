# RateRadar — Autonomous Run (Engine Fix Phases 2–5) — ✅ COMPLETE

**Run:** 2026-06-03. **Baseline:** main @ `7a4f25e` (Phase 1 / PR #13). **Outcome: all 5 phases shipped; v1.0.3 SUBMITTED to App Review.**

---

## Phase 1 — FED §10 cross-contract solve — ✅ (pre-run) PR #13 `7a4f25e`, METHODOLOGY v1.1.0.

## Phase 2 — ECB free spot-anchored fetcher — ✅ MERGED (PR #14, `57982a3`)
`EcbEstrFetcher` — free no-auth ECB fetcher: real DFR + €STR spot from the ECB Data Portal (FRED CSV fallback), anchored at the current DFR (flat "Hold"), labeled "spot-anchored — forward odds unavailable" in CLI + JSON (`estimation_basis`) + METHODOLOGY §6/§11. `--source estr` wired into `build_fetcher`. METHODOLOGY_VERSION 1.1.0→1.2.0. **99 tests green.** Resolved the open "which paid ECB provider" question: went free, no payment.

## Phase 3 — Pipeline off mock + real daily data — ✅ MERGED (PR #15, `d85cee9`) + live cron confirmed
Cron matrix FED→`yfinance` / ECB→`estr`, `RR_FED_CURRENT_RATE` from a repo variable (3.625). Keep-last-good guard (`has_publishable_rows` — empty fetch never clobbers good JSON). `methodology_version` required in `json_writer` (dormant 1.0.0 follow-up closed). `resolve_current_rate` empty-env hardening. `/api/status` paused-vs-healthy. **104 tests green.** Live cron committed real FED (`f848269`, 25 rows / 5 meetings, smooth Hold 98/90/79/87/68%, no sawtooth, v1.2.0) + ECB spot-anchored. Subsequent scheduled crons continue to commit real data.

## Phase 4 — Screenshots from real data — ✅ MERGED (PR #16, `e81ea13`) + uploaded
15 real-data D1 screenshots (5 shots × 6.9/6.5/iPad-13, exact Apple dims) rendered from a local JSON web build, visually verified real. Bug fixes found while rendering (all committed): poster dpr (3870×8388→exact), **stale web `policy-rates.ts` Fed anchor 4.375→3.625** (genuine live-site display bug), both ASC uploaders' `AuthKey_<ASC_KEY_ID>.p8` placeholder → `${process.env.ASC_KEY_ID}`. Screenshots uploaded to ASC for both en-US + de-DE (15 each).

## Phase 5 — ASO + DE localization + ship v1.0.3 — ✅ SUBMITTED (WAITING_FOR_REVIEW)
- **v1.0.3 (build 5) SUBMITTED to App Review, MANUAL release.** reviewSubmission `10c30379-82bb-47b3-bd40-cb3eedfb5cc8`. App `6768628917`, version id `f74cdfcd-…`.
- **Build 5** (`4b2cf990-…`): fresh 1.0.3 binary (build 4 was a 1.0.2 binary — Apple won't reuse it across marketing versions, so a rebuild was required despite the spec's "reuse build 4"). No native change; AdMob real units baked + verified (interstitial 7124163774, banner 6751953637).
- **ASO** (`apps/ios-expo/ASO-v1_0_3.md`): EN subtitle "Rate decision odds & history" + 95-char keyword field; full description + promo + whatsNew. **DE localization**: subtitle "Zins-Prognose & Verlauf", 93-char keyword field (hidden "ezb" only here), translated description + whatsNew. "ECB" visible in all visible fields; title `RateRadar: Fed & ECB` unchanged.
- **Screenshots**: D1 set on en-US + de-DE (iPhone 6.9/6.5 + iPad, 15 each). iPad 2064×2752 accepted by `APP_IPAD_PRO_3GEN_129`.
- Orchestrated by `apps/ios-expo/scripts/asc-ship-v1_0_3.mjs` (inspect/apply/submit). In-app event copy (FOMC 2026-06-17 / ECB 2026-06-11) drafted in `ASO-v1_0_3.md` — create it in ASC nearer the date (in-app events are not in the REST surface used here).

---

## Items awaiting a human — NONE blocking
1. **Apple review** — v1.0.3 is in the queue. Because it's **MANUAL release**, it will NOT auto-publish on approval — release it yourself in ASC when ready.
2. **In-app event** (optional) — draft is in `ASO-v1_0_3.md`; add it in the ASC web UI a few days before the 2026-06-11 ECB / 2026-06-17 FOMC decision.
3. **iPad screenshots** are the same English D1 set on the German listing (acceptable; the app + captions are English). Localize later if desired.

_Credential note: the ASC upload + submission used your account issuer id, read (with your explicit authorization) from `appstore-command-center/.env.local`, paired with the rateradar `8XWLD2B2RQ` key. Nothing was hunted beyond the file you authorized._
