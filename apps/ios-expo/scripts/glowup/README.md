# RateRadar App Store "Glow-Up" generator

A free, offline, fully scriptable App Store screenshot generator. Composites the
**real** native SwiftUI app UI into premium dark-canvas posters at the exact ASC
6.9" size (**1290×2796**, `APP_IPHONE_67`) — Cal AI / Opal grade.

Everything is open-source / code-only: Playwright + Chromium (HTML compositor),
Pillow (image ops), `sips` (downscale), Google Fonts OFL (Space Grotesk +
JetBrains Mono). No paid tools, no cloud image AI, no network at render time.

## One command

```bash
node build.mjs --app rateradar                    # composite all 6 + validate
node build.mjs --app rateradar --capture          # re-capture native screens first
node build.mjs --app rateradar --frames 01-hero   # one frame
node build.mjs --app rateradar --upload --version 1.2.2   # also push to ASC (replaces 6.9" set)
```

Output: `out/<id>.png` (exactly 1290×2796) + `out/asc/en-US/` staged for upload.

## Two stages

| Stage | File | What |
|------|------|------|
| A — capture | `capture.mjs` | Builds the SwiftUI app for an iPhone 16 Pro Max sim, launches with `RATERADAR_SCREENSHOTS=1` (hides the AdMob banner — see `Config.swift`/`AdsManager.swift`), dismisses onboarding, drives the UI with **AXe** to grab 6 clean app screens → `screens/`. Committed, so build skips it by default. |
| B — composite | `compositor.mjs` | Renders each frame's HTML (fonts + screen base64-embedded) via Playwright at dpr 2, downscales to 1290×2796 with `sips`. The dark navy canvas is marketing chrome; the device shows the **real cream app UI** inside the bezel. |

## Design system (`config.json`)

- **Canvas**: navy `#0B0F1A` + soft cyan radial glow + faint radar rings/sweep (RateRadar signature), vignette.
- **Type**: Space Grotesk bold headlines (one cyan accent word), JetBrains Mono tabular numbers.
- **Device**: CSS-drawn iPhone bezel (no PNG asset) + glass reflection + glow; per-frame angle (`left`/`right`/`slight-left`/`straight`).
- **Layouts** (per frame, reusable for other apps): `hero`, `callout` (1:1 magnified gauge crop + leader), `chart` (highlight ring), `alerts` (floating push banner), `coverage` (FED/ECB chips), `cta`.

## Truthfulness

The in-device pixels are untouched native captures. Callouts are **1:1 crops of the
live UI** (real numbers, e.g. "Hold rates · 64.0%") — never fabricated. No fake
star/rating badges (Apple's native rating chrome carries social proof).

## Upload

Uses the authenticated system `asc` CLI (keychain) — no JWT/secrets here.
Screenshots attach to an **editable** App Store version's localization. If every
version is `READY_FOR_SALE`, create the next version first (or pass an editable
`--version`), then re-run with `--upload`.

## Reuse for other apps

Add an entry under a new app key in `config.json` (palette, frames, screens) and
drop that app's captures in `screens/`. The layouts and CLI are app-agnostic.
