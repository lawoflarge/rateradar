// Captures App Store screenshots from the live RateRadar web app via Playwright.
//
// Output: 4 captures × 2 Apple iPhone sizes = 8 portrait PNGs.
//   APP_IPHONE_67 — 1290x2796 (iPhone 15 Pro Max range)
//   APP_IPHONE_65 — 1242x2688 (iPhone XS Max range)
//
// Filenames match `asc-upload-screenshots.mjs`'s defaults:
//   01-hero.png, 02-meeting.png, 03-history.png, 04-curve.png
//
// Written into apps/ios-expo/archive/screenshots/{6.9,6.5}/ — `archive/` is
// gitignored. Move/rename are NOT needed before invoking the uploader; that
// script reads from assets/screenshots/{6.9,6.5}/, so the user (or a follow-up
// step) should copy the archive output into assets/screenshots/ when ready
// to actually upload.
//
// Usage:
//   node scripts/capture-screenshots.mjs
// Env:
//   RR_BASE_URL — override live web URL (defaults to rateradar-web.vercel.app)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, "..", "archive", "screenshots");

const BASE = process.env.RR_BASE_URL ?? "https://rateradar-web.vercel.app";

// Apple's portrait iPhone buckets. dir matches asc-upload-screenshots.mjs.
const SIZES = [
  { name: "67", dir: "6.9", w: 1290, h: 2796, dpr: 3 },
  { name: "65", dir: "6.5", w: 1242, h: 2688, dpr: 3 },
];

// IDs must match asc-upload-screenshots.mjs FILES defaults.
const SHOTS = [
  { id: "01-hero", path: "/", scrollY: 0, waitForSelector: "h1" },
  { id: "02-meeting", path: null /* picked dynamically — first meeting card */, scrollY: 0, waitForSelector: "h1" },
  { id: "03-history", path: "/", scrollY: 1100, waitForSelector: "h1" },
  { id: "04-curve", path: "/compare", scrollY: 0, waitForSelector: "h1" },
];

async function pickFirstMeetingPath(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/meeting/"]');
    return a ? a.getAttribute("href") : null;
  });
  return href ?? "/methodology";
}

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const outDir = path.join(OUT_ROOT, size.dir);
    fs.mkdirSync(outDir, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: Math.round(size.w / size.dpr), height: Math.round(size.h / size.dpr) },
      deviceScaleFactor: size.dpr,
    });
    const page = await ctx.newPage();
    const meetingPath = await pickFirstMeetingPath(page);
    console.log(`[${size.dir}] meeting path: ${meetingPath}`);

    for (const shot of SHOTS) {
      const route = shot.id === "02-meeting" ? meetingPath : shot.path;
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      if (shot.waitForSelector) {
        await page.waitForSelector(shot.waitForSelector, { timeout: 8000 }).catch(() => {});
      }
      if (shot.scrollY > 0) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), shot.scrollY);
        await page.waitForTimeout(500);
      }
      const filename = `${shot.id}.png`;
      const out = path.join(outDir, filename);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ${filename} → ${out}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log("\nDone. Screenshots in:", OUT_ROOT);
console.log("To upload: copy into apps/ios-expo/assets/screenshots/{6.9,6.5}/ then run scripts/asc-upload-screenshots.mjs.");
