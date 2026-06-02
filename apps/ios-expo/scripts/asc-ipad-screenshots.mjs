/**
 * Capture + upload 4 iPad Pro 12.9" screenshots for ASC.
 *
 * Apple requires at least one iPad screenshot type for any app that supports
 * iPad device family. Expo apps default to iPhone+iPad, so submission of
 * RateRadar v1.0 failed with:
 *   STATE_ERROR.SCREENSHOT_REQUIRED.APP_IPAD_PRO_3GEN_129
 *
 * Rather than rebuild the binary with iPhone-only deviceFamily (another
 * Codemagic cycle), we just provide the required iPad screenshots from
 * the live web app at 2048×2732 portrait.
 *
 * One-shot script: captures via Playwright, uploads via ASC REST API.
 */
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ID = "6768628917";
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", `AuthKey_${process.env.ASC_KEY_ID}.p8`);
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const OUT_DIR = path.resolve(__dirname, "..", "assets", "screenshots", "ipad-13");
const BASE = "https://rateradar-web.vercel.app";
const DISPLAY = "APP_IPAD_PRO_3GEN_129";
const W = 2048;
const H = 2732;
const DPR = 2;

const SHOTS = [
  { id: "01-hero", path: "/", scrollY: 0 },
  { id: "02-history", path: "/", scrollY: 1200 },
  { id: "03-compare", path: "/compare", scrollY: 0 },
  { id: "04-methodology", path: "/methodology", scrollY: 0 },
];

function b64url(b) {
  return Buffer.from(b).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const p = b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const si = `${h}.${p}`;
  const sig = crypto.sign("SHA256", Buffer.from(si), {
    key: crypto.createPrivateKey(fs.readFileSync(KEY_PATH, "utf8")),
    dsaEncoding: "ieee-p1363",
  });
  return `${si}.${b64url(sig)}`;
}

async function api(token, method, p, body) {
  const r = await fetch("https://api.appstoreconnect.apple.com" + p, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d;
  try { d = t ? JSON.parse(t) : {}; } catch { d = { raw: t }; }
  return { ok: r.ok, status: r.status, data: d };
}

async function uploadBytes(op, bytes) {
  const headers = {};
  for (const h of op.requestHeaders || []) headers[h.name] = h.value;
  const r = await fetch(op.url, { method: op.method, headers, body: bytes });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`upload PUT ${r.status}: ${t.slice(0, 300)}`);
  }
}

async function main() {
  // 1. Capture screenshots
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("[1/3] Capturing iPad screenshots (2048x2732 portrait)...");
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: Math.round(W / DPR), height: Math.round(H / DPR) },
      deviceScaleFactor: DPR,
    });
    const page = await ctx.newPage();
    for (const s of SHOTS) {
      await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector("h1", { timeout: 8000 }).catch(() => {});
      if (s.scrollY > 0) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), s.scrollY);
        await page.waitForTimeout(500);
      }
      const out = path.join(OUT_DIR, `${s.id}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`     ${s.id}.png -> ${out}`);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }

  // 2. Find or create the screenshot set for APP_IPAD_PRO_3GEN_129
  const token = makeToken();
  console.log("[2/3] Finding appStoreVersionLocalization...");
  const ver = await api(token, "GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=1.0`);
  const versionId = ver.data.data[0].id;
  const locs = await api(token, "GET", `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const loc = (locs.data.data || []).find((l) => l.attributes.locale === "en-US");
  if (!loc) throw new Error("No en-US localization found");
  console.log(`     locale en-US: ${loc.id}`);

  const sets = await api(token, "GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  let set = (sets.data.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY);
  if (set) {
    console.log(`     existing set: ${set.id}`);
  } else {
    console.log(`     creating set for ${DISPLAY}...`);
    const create = await api(token, "POST", "/v1/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: DISPLAY },
        relationships: {
          appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } },
        },
      },
    });
    if (!create.ok) {
      console.error("create set FAILED:", create.status, JSON.stringify(create.data, null, 2));
      process.exit(1);
    }
    set = create.data.data;
    console.log(`     created set: ${set.id}`);
  }

  // 3. Upload each screenshot
  console.log("[3/3] Uploading 4 screenshots...");
  for (const s of SHOTS) {
    const file = path.join(OUT_DIR, `${s.id}.png`);
    const bytes = fs.readFileSync(file);
    const checksum = crypto.createHash("md5").update(bytes).digest("hex");
    const reserve = await api(token, "POST", "/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileName: `${s.id}.png`, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
      },
    });
    if (!reserve.ok) {
      console.error(`     reserve ${s.id} FAILED:`, reserve.status, JSON.stringify(reserve.data));
      process.exit(1);
    }
    const ss = reserve.data.data;
    const ops = ss.attributes.uploadOperations || [];
    for (const op of ops) await uploadBytes(op, bytes);
    const patch = await api(token, "PATCH", `/v1/appScreenshots/${ss.id}`, {
      data: { type: "appScreenshots", id: ss.id, attributes: { uploaded: true, sourceFileChecksum: checksum } },
    });
    if (!patch.ok) {
      console.error(`     PATCH ${s.id} FAILED:`, patch.status, JSON.stringify(patch.data));
      process.exit(1);
    }
    console.log(`     ${s.id}.png uploaded (${(bytes.length / 1024).toFixed(0)} KB)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
