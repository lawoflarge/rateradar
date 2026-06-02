// D1 App Store poster generator for RateRadar.
//
// "D1" = on-brand editorial direction: real app UI (Wire Room palette,
// IBM Plex Serif) captured as a clean tile, framed under an on-brand caption
// band. No raw web chrome, no ads — exactly how the app looks in the iOS
// WebView (we set window.NATIVE_PLATFORM = "ios", which makes AdSlot and the
// sticky anchor render nothing).
//
// Two-step per poster:
//   A) Capture a clean UI tile from the live web app (element screenshot).
//   B) Composite the tile into a portrait poster (cream canvas + small-caps
//      label + Plex Serif headline + framed tile + RateRadar wordmark),
//      rendered at exact Apple display dimensions.
//
// Output (gitignored): apps/ios-expo/archive/d1-candidates/<dir>/<id>.png
//
// Usage:
//   node scripts/capture-d1-posters.mjs
// Env:
//   RR_BASE_URL — live web URL (default https://rateradar-web.vercel.app)
//   RR_SIZES    — comma list of size keys to render (default all)
//   RR_SHOTS    — comma list of shot ids to render (default all)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// playwright isn't a dependency of this monorepo app — resolve it from the
// browser-automation toolkit by absolute path (ESM ignores cwd/NODE_PATH).
// Override with PLAYWRIGHT_PATH if installed elsewhere.
const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  "/Users/levinschwab/Data/Claude/browser-automation/node_modules/playwright/index.mjs";
const { chromium } = await import(PLAYWRIGHT_PATH);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, "..", "archive", "d1-candidates");
const BASE = process.env.RR_BASE_URL ?? "https://rateradar-web.vercel.app";

const PALETTE = {
  cream: "#F5F1E8",
  creamSoft: "#EFEADD",
  ink: "#0E0E0E",
  inkSoft: "#2B2B2B",
  inkMute: "#6F6A60",
  ruleSoft: "#C9C2B0",
  cut: "#C8841C",
};

// Apple display buckets. dir matches the uploader scripts.
const ALL_SIZES = [
  { key: "6.9", w: 1290, h: 2796, dpr: 3 },
  { key: "6.5", w: 1242, h: 2688, dpr: 3 },
  { key: "ipad-13", w: 2064, h: 2752, dpr: 2 },
];

// Each shot: which route, how to tag the tile element, and the caption.
// `headline` may contain <em> for an amber accent word. `headline: null`
// means the tile carries its own headline (the hero), so we show the label only.
const ALL_SHOTS = [
  {
    id: "01-hero",
    route: "/",
    label: "Fed & ECB rate-decision odds",
    headline: null,
    tag: () => {
      const el = document.querySelector("main > header");
      if (el) el.setAttribute("data-shot", "tile");
      return !!el;
    },
  },
  {
    id: "02-outcomes",
    route: "/",
    viewportWidth: 680,
    label: "Every outcome, every meeting",
    headline: "The full <em>probability</em> distribution.",
    prep: () => {
      // Hide the "Moved · last 7d" column (3rd) — currently all "flat".
      document.querySelectorAll("main table tr").forEach((tr) => {
        const c = tr.children[2];
        if (c) c.style.display = "none";
      });
    },
    tag: () => {
      const table = document.querySelector("main table");
      const el = table ? table.closest("div.overflow-hidden") : null;
      if (el) el.setAttribute("data-shot", "tile");
      return !!el;
    },
  },
  {
    id: "03-path",
    route: "/",
    label: "Most-likely rate path",
    headline: "Where the market sees rates <em>going</em>.",
    tag: () => {
      const el = [...document.querySelectorAll("div")].find(
        (d) =>
          typeof d.className === "string" &&
          d.className.includes("bg-cream-soft") &&
          d.className.includes("p-6") &&
          d.textContent.includes("Most-likely outcome at each"),
      );
      if (el) el.setAttribute("data-shot", "tile");
      return !!el;
    },
  },
  {
    id: "04-divergence",
    route: "/compare",
    label: "Fed vs ECB",
    headline: "<em>Divergence</em> at a glance.",
    tag: () => {
      const el = [...document.querySelectorAll("section")].find((s) =>
        s.textContent.includes("Divergence (Fed"),
      );
      if (el) el.setAttribute("data-shot", "tile");
      return !!el;
    },
  },
  {
    id: "05-curve",
    route: "/",
    label: "Implied rate curve",
    headline: "The <em>forward path</em>, priced.",
    tag: () => {
      const el = [...document.querySelectorAll("div")].find(
        (d) =>
          typeof d.className === "string" &&
          d.className.includes("bg-cream-soft") &&
          d.className.includes("p-6") &&
          d.textContent.includes("Implied policy-rate path"),
      );
      if (el) el.setAttribute("data-shot", "tile");
      return !!el;
    },
  },
];

const sizes = (process.env.RR_SIZES
  ? process.env.RR_SIZES.split(",").map((s) => s.trim())
  : ALL_SIZES.map((s) => s.key)
).map((k) => ALL_SIZES.find((s) => s.key === k)).filter(Boolean);

const shots = (process.env.RR_SHOTS
  ? process.env.RR_SHOTS.split(",").map((s) => s.trim())
  : ALL_SHOTS.map((s) => s.id)
).map((id) => ALL_SHOTS.find((s) => s.id === id)).filter(Boolean);

function posterHtml({ w, h, label, headline, tileDataUri }) {
  const pad = Math.round(w * 0.06);
  const labelSize = Math.round(w * 0.0235);
  const headlineSize = Math.round(w * 0.066);
  const footSize = Math.round(w * 0.026);
  const dotSize = Math.round(w * 0.02);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;background:${PALETTE.cream};overflow:hidden}
  .poster{width:${w}px;height:${h}px;display:flex;flex-direction:column;padding:${pad}px}
  .cap{flex:0 0 auto}
  .label{font-family:Inter,sans-serif;font-weight:600;font-variant-caps:all-small-caps;
    text-transform:lowercase;letter-spacing:0.14em;color:${PALETTE.cut};font-size:${labelSize}px}
  .headline{font-family:'IBM Plex Serif',serif;font-weight:500;color:${PALETTE.ink};
    font-size:${headlineSize}px;line-height:1.04;letter-spacing:-0.01em;margin-top:${Math.round(pad * 0.28)}px;max-width:92%}
  .headline em{color:${PALETTE.cut};font-style:normal}
  .stage{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;
    margin-top:${Math.round(pad * 0.55)}px;margin-bottom:${Math.round(pad * 0.4)}px}
  .frame{max-width:100%;max-height:100%;display:flex;border:1px solid rgba(14,14,14,0.12);
    border-radius:${Math.round(w * 0.016)}px;overflow:hidden;background:${PALETTE.creamSoft};
    box-shadow:0 ${Math.round(w * 0.02)}px ${Math.round(w * 0.05)}px rgba(14,14,14,0.10)}
  .frame img{display:block;max-width:100%;max-height:100%;object-fit:contain}
  .foot{flex:0 0 auto;display:flex;align-items:center;gap:${Math.round(w * 0.012)}px;
    color:${PALETTE.inkMute};font-family:Inter,sans-serif;font-weight:600;font-size:${footSize}px;letter-spacing:-0.01em}
  .dot{width:${dotSize}px;height:${dotSize}px;border-radius:999px;border:2px solid ${PALETTE.ink};position:relative}
  .dot::after{content:"";position:absolute;inset:25%;border-radius:999px;background:${PALETTE.cut}}
</style></head>
<body><div class="poster">
  <div class="cap">
    <div class="label">${label}</div>
    ${headline ? `<div class="headline">${headline}</div>` : ""}
  </div>
  <div class="stage"><div class="frame"><img src="${tileDataUri}"></div></div>
  <div class="foot"><span class="dot"></span><span>RateRadar</span></div>
</div></body></html>`;
}

async function rankMeetingsByMovement(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const ids = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('a[href^="/meeting/"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(/^\/meeting\/([^/?#]+)/);
      if (m) set.add(m[1]);
    });
    return [...set];
  });
  const scored = [];
  for (const id of ids) {
    const info = await page.evaluate(async (mid) => {
      try {
        const r = await fetch(`/api/meetings/${mid}/history?window=60d`, { cache: "no-store" });
        const j = await r.json();
        const data = j.data || [];
        let movementPp = 0;
        let days = 0;
        for (const s of data) {
          if (!s.series || s.series.length === 0) continue;
          const ps = s.series.map((p) => p.probability);
          movementPp = Math.max(movementPp, (Math.max(...ps) - Math.min(...ps)) * 100);
          days = Math.max(days, s.series.length);
        }
        return { movementPp, days };
      } catch {
        return { movementPp: 0, days: 0 };
      }
    }, id);
    scored.push({ id, ...info });
  }
  scored.sort((a, b) => b.movementPp - a.movementPp);
  return scored;
}

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const outDir = path.join(OUT_ROOT, size.key);
    fs.mkdirSync(outDir, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: Math.round(size.w / size.dpr), height: Math.round(size.h / size.dpr) },
      deviceScaleFactor: size.dpr,
    });
    // Emulate the iOS WebView so ads / sticky anchor render nothing.
    await ctx.addInitScript(() => {
      window.NATIVE_PLATFORM = "ios";
    });
    const page = await ctx.newPage();

    let movedPath = null;
    if (shots.some((s) => s.route === "__moved__")) {
      const ranking = await rankMeetingsByMovement(page);
      console.log(`[${size.key}] movement ranking (pp · days):`);
      for (const r of ranking) console.log(`    ${r.id}: ${r.movementPp.toFixed(1)}pp · ${r.days}d`);
      const top = ranking[0];
      movedPath = top ? `/meeting/${top.id}` : null;
      console.log(`[${size.key}] most-moved: ${movedPath ?? "NONE"}`);
    }

    for (const shot of shots) {
      const route = shot.route === "__moved__" ? movedPath : shot.route;
      if (!route) {
        console.log(`  ⚠ ${shot.id}: no route, skipping`);
        continue;
      }
      const baseW = Math.round(size.w / size.dpr);
      await page.setViewportSize({
        width: shot.viewportWidth ?? baseW,
        height: Math.round(size.h / size.dpr),
      });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      // Hide global nav defensively (it's a sibling of <main>, but be safe).
      await page.addStyleTag({
        content: `nav.sticky,[aria-label="Sponsored"],[aria-label="Advertisement"]{display:none!important}`,
      });
      if (shot.prep) await page.evaluate(shot.prep);
      const found = await page.evaluate(shot.tag);
      if (!found) {
        console.log(`  ⚠ ${shot.id}: tile element not found, skipping`);
        continue;
      }
      const tile = page.locator('[data-shot="tile"]').first();
      // For charts, wait for the SVG to paint.
      await tile.locator("svg").first().waitFor({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(500);

      const tileBuf = await tile.screenshot();
      const tileDataUri = `data:image/png;base64,${tileBuf.toString("base64")}`;

      // Composite the poster.
      const poster = await ctx.newPage();
      await poster.setViewportSize({ width: size.w, height: size.h });
      await poster.setContent(
        posterHtml({ w: size.w, h: size.h, label: shot.label, headline: shot.headline, tileDataUri }),
        { waitUntil: "networkidle" },
      );
      await poster.evaluate(() => document.fonts.ready);
      await poster.waitForTimeout(300);
      const out = path.join(outDir, `${shot.id}.png`);
      await poster.screenshot({ path: out });
      await poster.close();
      console.log(`  ✓ ${shot.id} → ${out}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log("\nDone. D1 candidates in:", OUT_ROOT);
