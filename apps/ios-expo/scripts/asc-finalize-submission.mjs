// One-shot pre-submission finalizer for RateRadar v1.0.
//
// Performs (idempotently) every ASC API operation that can be done WITHOUT
// the web UI:
//   1. Content Rights — PATCH /v1/apps/{id} contentRightsDeclaration
//   2. Pricing       — POST /v1/appPriceSchedules (Free + all territories)
//   3. Verify        — re-fetch state and print a green/red checklist
//
// App Privacy questionnaire is intentionally handled by a separate script
// (asc-fill-app-privacy.mjs) because the resource model is large.
//
// Submit-for-Review is NOT in this script — that's the deliberate gate
// requiring Levin's explicit visual confirmation that build 26 works.
//
// Usage: node scripts/asc-finalize-submission.mjs
//        node scripts/asc-finalize-submission.mjs --dry-run

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

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

const DRY = process.argv.includes("--dry-run");

function b64url(b) {
  return Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function makeToken() {
  const h = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const n = Math.floor(Date.now() / 1000);
  const p = { iss: ISSUER_ID, iat: n, exp: n + 60 * 15, aud: "appstoreconnect-v1" };
  const si = `${b64url(JSON.stringify(h))}.${b64url(JSON.stringify(p))}`;
  const k = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const s = crypto.sign("SHA256", Buffer.from(si), { key: k, dsaEncoding: "ieee-p1363" });
  return `${si}.${b64url(s)}`;
}
const token = makeToken();

async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, body: j };
}

function tag(ok, msg) {
  console.log(`  ${ok ? "✓" : "✗"} ${msg}`);
}

// ─── 1. Content Rights ────────────────────────────────────────────────
async function setContentRights() {
  console.log("\n[1] Content Rights");
  const cur = await api("GET", `/v1/apps/${APP_ID}`);
  const decl = cur.body.data?.attributes?.contentRightsDeclaration;
  console.log(`  current: ${decl ?? "<unset>"}`);
  if (decl === "DOES_NOT_USE_THIRD_PARTY_CONTENT") {
    tag(true, "already set to DOES_NOT_USE_THIRD_PARTY_CONTENT");
    return true;
  }
  if (DRY) {
    tag(true, "[dry-run] would PATCH to DOES_NOT_USE_THIRD_PARTY_CONTENT");
    return true;
  }
  const res = await api("PATCH", `/v1/apps/${APP_ID}`, {
    data: {
      type: "apps",
      id: APP_ID,
      attributes: { contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT" },
    },
  });
  tag(res.ok, `PATCH -> ${res.status}`);
  if (!res.ok) console.log("    " + JSON.stringify(res.body).slice(0, 400));
  return res.ok;
}

// ─── 2. Pricing (Free + all territories) ──────────────────────────────
// Apple requires creating an appPriceSchedule with:
//   - relationships.baseTerritory  -> USA (most common base)
//   - relationships.manualPrices   -> at least one appPrice resource at price tier 0 (Free)
// The price point for "Free" in USA is found by listing /v2/appPricePoints
// filtered by app + territory + priceTier=0. Or use the canonical "USD_0_TIER".
async function setPricingFree() {
  console.log("\n[2] Pricing (Free + all territories)");

  // Check current schedule first
  const schedRel = await api("GET", `/v1/apps/${APP_ID}/relationships/priceSchedule`);
  if (schedRel.ok && schedRel.body.data) {
    const schedId = schedRel.body.data.id;
    const sched = await api("GET", `/v2/appPriceSchedules/${schedId}?include=manualPrices,baseTerritory`);
    if (sched.ok) {
      const manualPrices = (sched.body.included || []).filter((i) => i.type === "appPrices");
      const baseTerritory = (sched.body.included || []).find((i) => i.type === "territories");
      console.log(`  existing schedule: ${schedId}`);
      console.log(`    baseTerritory: ${baseTerritory?.id ?? "?"}`);
      console.log(`    manualPrices: ${manualPrices.length}`);
      if (manualPrices.length > 0) {
        tag(true, "pricing schedule already exists with at least one price");
        return true;
      }
    }
  }

  // Find the Free price point in USA. Apple's pricing API requires the
  // app price point ID, which encodes app + territory + tier as base64 JSON.
  // The relationship endpoint /v1/apps/{id}/appPricePoints supports
  // filter[territory] (NOT the top-level /v1/appPricePoints which 404s).
  const pp = await api("GET", `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=USA&limit=200`);
  if (!pp.ok) {
    tag(false, `list appPricePoints -> ${pp.status}: ${JSON.stringify(pp.body).slice(0, 300)}`);
    return false;
  }
  const freePoint = (pp.body.data || []).find((p) => {
    const c = p.attributes?.customerPrice;
    return c === "0" || c === "0.0" || c === "0.00" || Number(c) === 0;
  });
  if (!freePoint) {
    tag(false, "no Free price point found in USA territory listing");
    return false;
  }
  console.log(`  free price point (USA): ${freePoint.id}`);

  if (DRY) {
    tag(true, "[dry-run] would POST appPriceSchedule with Free tier in USA + automaticPrices: true");
    return true;
  }

  const res = await api("POST", "/v1/appPriceSchedules", {
    data: {
      type: "appPriceSchedules",
      relationships: {
        app: { data: { type: "apps", id: APP_ID } },
        baseTerritory: { data: { type: "territories", id: "USA" } },
        manualPrices: {
          data: [{ type: "appPrices", id: "${price1}" }],
        },
      },
    },
    included: [
      {
        type: "appPrices",
        id: "${price1}",
        attributes: { startDate: null },
        relationships: {
          appPricePoint: { data: { type: "appPricePoints", id: freePoint.id } },
        },
      },
    ],
  });
  tag(res.ok, `POST appPriceSchedules -> ${res.status}`);
  if (!res.ok) console.log("    " + JSON.stringify(res.body).slice(0, 600));
  return res.ok;
}

// ─── 3. Verify ─────────────────────────────────────────────────────────
async function verify() {
  console.log("\n[3] Verify state");

  // Build attachment
  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const v = versions.body.data?.find(
    (vv) => vv.attributes?.versionString === "1.0" && vv.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION",
  );
  if (!v) {
    tag(false, "no editable v1.0 found");
    return;
  }
  const buildRel = await api("GET", `/v1/appStoreVersions/${v.id}/relationships/build`);
  const buildId = buildRel.body.data?.id;
  if (buildId) {
    const b = await api("GET", `/v1/builds/${buildId}`);
    const bv = b.body.data?.attributes?.version;
    tag(true, `build attached: v${bv} (${buildId})`);
  } else {
    tag(false, "no build attached to v1.0");
  }

  // Content rights
  const app = await api("GET", `/v1/apps/${APP_ID}`);
  const cr = app.body.data?.attributes?.contentRightsDeclaration;
  tag(cr === "DOES_NOT_USE_THIRD_PARTY_CONTENT", `contentRightsDeclaration = ${cr ?? "<unset>"}`);

  // Pricing
  const schedRel = await api("GET", `/v1/apps/${APP_ID}/relationships/priceSchedule`);
  tag(!!schedRel.body.data, `pricing schedule: ${schedRel.body.data?.id ?? "<unset>"}`);

  // Screenshots
  const verLocs = await api("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  const loc = verLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (loc) {
    const sets = await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
    const setsList = sets.body.data || [];
    tag(setsList.length >= 1, `screenshot sets: ${setsList.length}`);
    for (const s of setsList) {
      const inner = await api("GET", `/v1/appScreenshotSets/${s.id}/appScreenshots?limit=20`);
      const n = inner.body.data?.length ?? 0;
      console.log(`    - ${s.attributes?.screenshotDisplayType}: ${n} shots`);
    }
  }

  // Age rating
  const info = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
  const ai = info.body.data?.find((i) => i.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION") || info.body.data?.[0];
  if (ai) {
    const ard = await api("GET", `/v1/ageRatingDeclarations/${ai.id}`);
    tag(!!ard.body.data, "ageRatingDeclaration present");
  }
}

(async () => {
  console.log(`ASC finalize — App ${APP_ID}${DRY ? " (DRY RUN)" : ""}`);
  await setContentRights();
  await setPricingFree();
  await verify();
  console.log("\nNext: review state in ASC web UI; if everything looks good, submit via scripts/asc-submit-for-review.mjs.");
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
