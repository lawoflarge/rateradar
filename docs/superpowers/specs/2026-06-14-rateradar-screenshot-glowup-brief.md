# RateRadar — App Store Screenshot Glow-Up (Build Brief)

> Created 2026-06-14. Status: ready to build by a fresh agent. 100% free + fully scriptable.
> Full master prompt + idea->frame mapping below. Brain mirror: 10_Projects/RateRadar/next-agent-screenshot-glowup.md

## Why
RateRadar's #1 growth lever is conversion (impression -> page-view ~5% vs ~14.5% benchmark; app
ranks #1 "fed rate" / #2 "rate cut"). The v1.2.1 posters (shipped 2026-06-13) already fixed
thumbnail legibility (bold amber headline on ink + native app-shot in a flat device frame). This
brief is the next level: angled 3D devices, a hand-held lifestyle frame, called-out detail zooms,
and richer off-app brand elements (Cal AI / Opal / Oura quality).

## Hard constraints
- 100% free + offline-capable. Open-source only: Playwright/Chromium, Pillow (+OpenCV), Google
  Fonts (OFL), optional Three.js. NO paid tools, NO paid image AI, no cloud API.
- Fully scriptable via Claude Code — one CLI command renders all frames.
- Exact ASC size 1290x2796 (_67) + 1284x2778 (_65). NOT native 1320x2868.
- Reuse the existing v1.2.1 HTML+Playwright compositor + native Sim-capture flow (AXe nav).

## Master prompt (paste-ready)
See the brain mirror for the verbatim block; identical content. Key beats:
- Design system: deep ink/navy #0B0F1A bg + radial/mesh gradient; accent cyan-green #00E0A4;
  down=#FF5C6E; radar sweep motif; Space Grotesk / Inter Tight headlines; Geist/JetBrains Mono odds.
- 6-frame arc: 1 HERO angled "Predict the Fed's next move" · 2 LIVE ODDS callout "68% cut" ·
  3 FORWARD CURVE angled +15deg · 4 ALERTS device-in-hand + push callout · 5 FED+ECB chips ·
  6 SOCIAL PROOF stars + "Download free".
- Effects: CSS-3D angled + glass reflection/glow; hand via CC0 PNG + Pillow 4-point perspective
  warp (fallback angled-CSS); callouts = crop->upscale->floating card + connector.
- Pipeline: scripts/glowup/ HTML templates + config.json; Playwright renders at 1290x2796;
  `node scripts/glowup/build.mjs --app rateradar`; --layout flags reusable.
- Verify: thumbnail legibility, palette/type consistency, exact dims, image-verified output.

## Sources
screensdesign.com Cal AI breakdown; asomobile.net 2025 guide; dev.to 2026 convert guide.
