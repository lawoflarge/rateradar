/**
 * One-shot App Store Connect API setup for RateRadar.
 * Pure ESM + node:crypto, no deps.
 *
 * Steps:
 *   1. Sign a JWT with the ASC API key (ES256).
 *   2. Verify auth (GET /v1/apps).
 *   3. Register bundle id `com.lawoflarge.rateradar` (skip if exists).
 *   4. Create the ASC app record (skip if exists).
 *   5. Save the ASC App ID to .secrets/asc-app-id.txt.
 *   6. Patch the placeholder in eas.json with the real ASC app id.
 *
 * Idempotent — safe to re-run.
 *
 * No Sign-in-with-Apple capability step here (unlike Relatably's asc-setup.js):
 * RateRadar is an anonymous WebView client; no SIWA needed.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const KEY_PATH =
  process.env.ASC_KEY_PATH ||
  path.resolve(ROOT, ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = process.env.ASC_KEY_ID || "8XWLD2B2RQ";
const ISSUER_ID =
  process.env.ASC_ISSUER_ID || "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

const BUNDLE_ID = "com.lawoflarge.rateradar";
const APP_NAME = "RateRadar";
const APP_SKU = "rateradar-v1";
const PRIMARY_LOCALE = "en-US";

const API = "https://api.appstoreconnect.apple.com";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ECDSA outputs DER; Apple expects raw r||s (64 bytes for P-256). Convert.
function derToJose(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("bad der seq");
  let len = der[i++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let j = 0; j < n; j++) len = (len << 8) | der[i++];
  }
  function readInt() {
    if (der[i++] !== 0x02) throw new Error("bad der int");
    let l = der[i++];
    if (l & 0x80) {
      const n = l & 0x7f;
      l = 0;
      for (let j = 0; j < n; j++) l = (l << 8) | der[i++];
    }
    let val = der.slice(i, i + l);
    i += l;
    while (val.length > 32) val = val.slice(1);
    if (val.length < 32) {
      val = Buffer.concat([Buffer.alloc(32 - val.length), val]);
    }
    return val;
  }
  const r = readInt();
  const s = readInt();
  return Buffer.concat([r, s]);
}

function signToken() {
  const privateKey = fs.readFileSync(KEY_PATH, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const headerB = b64url(JSON.stringify(header));
  const payloadB = b64url(JSON.stringify(payload));
  const signingInput = `${headerB}.${payloadB}`;

  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  const derSig = signer.sign(privateKey);
  const joseSig = derToJose(derSig);
  return `${signingInput}.${b64url(joseSig)}`;
}

async function call(method, urlPath, token, body) {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function updateEasJsonAppId(appId) {
  const easJsonPath = path.resolve(ROOT, "eas.json");
  if (!fs.existsSync(easJsonPath)) {
    console.log("      (eas.json not found — skipping placeholder swap)");
    return false;
  }
  const raw = fs.readFileSync(easJsonPath, "utf8");
  const placeholder = "PLACEHOLDER_REPLACE_AFTER_ASC_APP_CREATE";
  if (!raw.includes(placeholder) && raw.includes(`"ascAppId": "${appId}"`)) {
    console.log("      eas.json already has the real ascAppId — no change.");
    return false;
  }
  if (!raw.includes(placeholder)) {
    console.log(
      "      WARN: eas.json has no placeholder AND no matching ascAppId. Skipping."
    );
    return false;
  }
  const updated = raw.replace(placeholder, appId);
  fs.writeFileSync(easJsonPath, updated);
  console.log(`      eas.json placeholder replaced -> ${appId}`);
  return true;
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`[FATAL] .p8 not found at ${KEY_PATH}`);
    process.exit(1);
  }
  console.log("[1/5] Signing JWT (ES256, native crypto)...");
  const token = signToken();
  console.log("      JWT len:", token.length);

  console.log("[2/5] GET /v1/apps?limit=1 (auth check)...");
  const ping = await call("GET", "/v1/apps?limit=1", token);
  if (!ping.ok) {
    console.error("      AUTH FAILED:", ping.status);
    console.error("      ", JSON.stringify(ping.data, null, 2));
    process.exit(1);
  }
  console.log(`      OK (${ping.data.data?.length ?? 0} app visible)`);

  console.log(`[3/5] Looking up bundle ${BUNDLE_ID}...`);
  const lookup = await call(
    "GET",
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`,
    token
  );
  if (!lookup.ok) {
    console.error(
      "      Lookup FAILED:",
      lookup.status,
      JSON.stringify(lookup.data)
    );
    process.exit(1);
  }
  let bundle = (lookup.data.data || []).find(
    (b) => b.attributes?.identifier === BUNDLE_ID
  );
  if (bundle) {
    console.log(`      Exists: ${bundle.id}`);
  } else {
    console.log("      Creating...");
    const created = await call("POST", "/v1/bundleIds", token, {
      data: {
        type: "bundleIds",
        attributes: {
          identifier: BUNDLE_ID,
          name: APP_NAME,
          platform: "IOS",
        },
      },
    });
    if (!created.ok) {
      console.error(
        "      Bundle CREATE FAILED:",
        created.status,
        JSON.stringify(created.data, null, 2)
      );
      process.exit(1);
    }
    bundle = created.data.data;
    console.log(`      Created: ${bundle.id}`);
  }

  console.log("[4/5] Looking up ASC app record...");
  const appLookup = await call(
    "GET",
    `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=10`,
    token
  );
  if (!appLookup.ok) {
    console.error(
      "      App lookup FAILED:",
      appLookup.status,
      JSON.stringify(appLookup.data)
    );
    process.exit(1);
  }
  let app = (appLookup.data.data || []).find(
    (a) => a.attributes?.bundleId === BUNDLE_ID
  );
  if (app) {
    console.log(`      Exists: id=${app.id} name="${app.attributes.name}"`);
  } else {
    console.log("      Creating ASC app record...");
    const createApp = await call("POST", "/v1/apps", token, {
      data: {
        type: "apps",
        attributes: {
          bundleId: BUNDLE_ID,
          name: APP_NAME,
          primaryLocale: PRIMARY_LOCALE,
          sku: APP_SKU,
        },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundle.id } },
        },
      },
    });
    if (!createApp.ok) {
      // 409 with "already exists" message: treat as success and re-lookup.
      const dataStr = JSON.stringify(createApp.data);
      if (
        createApp.status === 409 ||
        /already exists/i.test(dataStr) ||
        /entity already exists/i.test(dataStr)
      ) {
        console.log(
          `      App already exists (HTTP ${createApp.status}); re-fetching...`
        );
        const reLookup = await call(
          "GET",
          `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=10`,
          token
        );
        app = (reLookup.data.data || []).find(
          (a) => a.attributes?.bundleId === BUNDLE_ID
        );
        if (!app) {
          console.error(
            "      Still cannot resolve app record after 409 retry."
          );
          process.exit(1);
        }
        console.log(`      Resolved: id=${app.id}`);
      } else {
        console.error(
          "      App CREATE FAILED:",
          createApp.status,
          JSON.stringify(createApp.data, null, 2)
        );
        process.exit(1);
      }
    } else {
      app = createApp.data.data;
      console.log(`      Created: id=${app.id}`);
    }
  }

  console.log("[5/5] Persisting app id...");
  const secretsDir = path.resolve(ROOT, ".secrets");
  if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
  const appIdFile = path.resolve(secretsDir, "asc-app-id.txt");
  fs.writeFileSync(
    appIdFile,
    `ASC_APP_ID=${app.id}\nBUNDLE_RECORD_ID=${bundle.id}\nBUNDLE_ID=${BUNDLE_ID}\n`
  );
  console.log(`      Saved to ${appIdFile}`);

  updateEasJsonAppId(app.id);

  console.log("");
  console.log("=========================");
  console.log("ASC App ID:", app.id);
  console.log("Bundle ID :", BUNDLE_ID);
  console.log("=========================");
  console.log("");
  console.log(
    "Next: update codemagic.yaml's APP_STORE_APPLE_ID placeholder with this id."
  );
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
