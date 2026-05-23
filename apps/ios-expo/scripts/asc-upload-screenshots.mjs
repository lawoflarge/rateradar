// Uploads App Store screenshots for RateRadar v1.0 via the ASC REST API.
// Idempotent — skips any displayType set that already has >=4 screenshots.
//
// Reads from:
//   apps/ios-expo/assets/screenshots/6.9/*.png   (1290x2796 — iPhone 6.9")
//   apps/ios-expo/assets/screenshots/6.5/*.png   (1242x2688 — iPhone 6.5")
//
// Apple's 3-step upload flow:
//   1) POST /v1/appScreenshotSets  → create set for displayType + localization
//   2) POST /v1/appScreenshots     → reserve, returns uploadOperations
//   3) For each operation: PUT raw bytes to S3-style URL with provided headers
//   4) PATCH /v1/appScreenshots/{id} { uploaded:true, sourceFileChecksum: md5 }
//
// Usage: node scripts/asc-upload-screenshots.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_<ASC_KEY_ID>.p8");
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;

// Resolve APP_ID from .secrets/asc-app-id.txt (written by asc-create-app.mjs).
function loadAppId() {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const file = path.resolve(__dirname, "..", ".secrets", "asc-app-id.txt");
  if (!fs.existsSync(file)) {
    throw new Error(
      "Missing .secrets/asc-app-id.txt — run `node scripts/asc-create-app.mjs` first."
    );
  }
  const m = fs.readFileSync(file, "utf8").match(/^ASC_APP_ID=(\S+)/m);
  if (!m) throw new Error("asc-app-id.txt missing ASC_APP_ID=… line");
  return m[1];
}
const APP_ID = loadAppId();

const SHOTS_DIR = path.resolve(__dirname, "..", "assets", "screenshots");

// Apple's ASC API enum has not added APP_IPHONE_69 yet — 1290x2796 screenshots
// (iPhone 15 Pro Max + iPhone 16 Pro Max range) are uploaded under APP_IPHONE_67.
const DISPLAYS = [
  { displayType: "APP_IPHONE_67", dir: "6.9", expectedW: 1290, expectedH: 2796 },
  { displayType: "APP_IPHONE_65", dir: "6.5", expectedW: 1242, expectedH: 2688 },
];

// Per-app screenshot filenames. Override at call time with ASC_SCREENSHOT_FILES
// (comma-separated). Default placeholders for RateRadar v1.0 hero shots —
// replace these PNGs in assets/screenshots/{6.9,6.5}/ before running.
const FILES = (process.env.ASC_SCREENSHOT_FILES || "01-hero.png,02-meeting.png,03-history.png,04-curve.png")
  .split(",")
  .map((s) => s.trim());

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function makeToken() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}

const token = makeToken();

async function api(method, pathSuffix, body) {
  const url = `https://api.appstoreconnect.apple.com${pathSuffix}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, body: json, ok: r.ok };
}

function pngDims(filePath) {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function uploadChunk(operation, fileBuffer) {
  const headers = {};
  for (const h of operation.requestHeaders || []) headers[h.name] = h.value;
  const slice = fileBuffer.subarray(operation.offset, operation.offset + operation.length);
  const r = await fetch(operation.url, {
    method: operation.method,
    headers,
    body: slice,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`PUT chunk failed ${r.status}: ${txt.slice(0, 400)}`);
  }
}

async function ensureScreenshotSet(verLocId, displayType) {
  // Check if set already exists for this display type
  const sets = await api("GET", `/v1/appStoreVersionLocalizations/${verLocId}/appScreenshotSets?limit=50`);
  if (!sets.ok) throw new Error(`List sets failed: ${JSON.stringify(sets.body).slice(0, 400)}`);
  const existing = sets.body.data?.find((s) => s.attributes?.screenshotDisplayType === displayType);
  if (existing) return existing.id;

  const created = await api("POST", "/v1/appScreenshotSets", {
    data: {
      type: "appScreenshotSets",
      attributes: { screenshotDisplayType: displayType },
      relationships: {
        appStoreVersionLocalization: {
          data: { type: "appStoreVersionLocalizations", id: verLocId },
        },
      },
    },
  });
  if (!created.ok) throw new Error(`Create set ${displayType} failed: ${JSON.stringify(created.body).slice(0, 400)}`);
  return created.body.data.id;
}

async function countScreenshotsInSet(setId) {
  const r = await api("GET", `/v1/appScreenshotSets/${setId}/appScreenshots?limit=20`);
  if (!r.ok) return 0;
  return r.body.data?.length || 0;
}

async function uploadOne(setId, filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  // 1) Reserve
  const reserved = await api("POST", "/v1/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileSize, fileName },
      relationships: {
        appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } },
      },
    },
  });
  if (!reserved.ok) throw new Error(`Reserve ${fileName} failed: ${JSON.stringify(reserved.body).slice(0, 400)}`);
  const shotId = reserved.body.data.id;
  const uploadOperations = reserved.body.data.attributes.uploadOperations || [];

  // 2) PUT each chunk
  for (const op of uploadOperations) {
    await uploadChunk(op, fileBuffer);
  }

  // 3) Commit with MD5 checksum
  const md5 = crypto.createHash("md5").update(fileBuffer).digest("hex");
  const committed = await api("PATCH", `/v1/appScreenshots/${shotId}`, {
    data: {
      type: "appScreenshots",
      id: shotId,
      attributes: { uploaded: true, sourceFileChecksum: md5 },
    },
  });
  if (!committed.ok) throw new Error(`Commit ${fileName} failed: ${JSON.stringify(committed.body).slice(0, 400)}`);
  return shotId;
}

(async () => {
  console.log(`ASC screenshot upload — App ${APP_ID}\n`);

  // Resolve v1.0 en-US localization
  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const version = versions.body.data?.find(
    (v) => v.attributes?.versionString === "1.0" && v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION"
  );
  if (!version) throw new Error("No editable v1.0 appStoreVersion found.");
  console.log(`appStoreVersion: ${version.id} (v${version.attributes.versionString})`);

  const verLocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  const verLoc = verLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (!verLoc) throw new Error("No en-US appStoreVersionLocalization.");
  console.log(`appStoreVersionLocalization (en-US): ${verLoc.id}\n`);

  for (const disp of DISPLAYS) {
    const dirPath = path.join(SHOTS_DIR, disp.dir);
    console.log(`── ${disp.displayType} (${disp.dir}") ─────────────`);

    // Verify dimensions before reserving anything
    for (const f of FILES) {
      const fp = path.join(dirPath, f);
      const dims = pngDims(fp);
      if (dims.w !== disp.expectedW || dims.h !== disp.expectedH) {
        throw new Error(
          `${disp.dir}/${f} is ${dims.w}x${dims.h}; Apple expects ${disp.expectedW}x${disp.expectedH} for ${disp.displayType}`
        );
      }
    }

    const setId = await ensureScreenshotSet(verLoc.id, disp.displayType);
    const existingCount = await countScreenshotsInSet(setId);
    console.log(`  set=${setId}  existing=${existingCount}`);

    if (existingCount >= FILES.length) {
      console.log(`  ✓ already has ${existingCount} screenshots — skipping`);
      continue;
    }

    for (const f of FILES) {
      const fp = path.join(dirPath, f);
      const size = fs.statSync(fp).size;
      process.stdout.write(`  ↑ ${f} (${(size / 1024).toFixed(0)} KB)…`);
      const id = await uploadOne(setId, fp, f);
      console.log(` ${id}`);
    }
  }

  console.log("\nDone. Verify in ASC web UI → My Apps → RateRadar → 1.0 Prepare for Submission → screenshots.");
})().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
