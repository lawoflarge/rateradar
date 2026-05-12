/**
 * Enable PUSH_NOTIFICATIONS capability on bundle id `com.lawoflarge.rateradar`.
 *
 * Why this exists: `asc-create-app.mjs` registers the bundle id via the ASC
 * REST API. API-created bundle ids have ZERO capabilities by default. When
 * Codemagic's `fetch-signing-files` mints a provisioning profile, the profile
 * inherits the bundle's empty capability set, so it lacks `Push Notifications`
 * and the `aps-environment` entitlement. `expo-notifications` writes
 * `aps-environment` into the .entitlements file at prebuild, then xcodebuild
 * archive fails:
 *
 *   error: Provisioning profile "..." doesn't include the Push Notifications
 *          capability.
 *   error: Provisioning profile "..." doesn't include the aps-environment
 *          entitlement.
 *
 * Build #3 (commit 02e45fa) hit this. Fix: enable PUSH_NOTIFICATIONS on the
 * bundle id ONCE via this script, then re-run the Codemagic build. The
 * capability persists in ASC across builds.
 *
 * Idempotent — checks existing capabilities first, no-op if already enabled.
 *
 * Local usage (one-shot):
 *   node scripts/asc-enable-push-notifications.mjs
 *
 * CI usage: also wired into codemagic.yaml as a defensive pre-step (uses env
 * vars APP_STORE_CONNECT_KEY_IDENTIFIER / ISSUER_ID / PRIVATE_KEY from the
 * `relatably-asc` integration, just like asc-revoke-distribution-certs-ci.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BUNDLE_ID = "com.lawoflarge.rateradar";
const CAPABILITY = "PUSH_NOTIFICATIONS";
const API = "https://api.appstoreconnect.apple.com";

// Dual local/CI auth — match the pattern of asc-revoke-distribution-certs-ci.mjs.
const CI_KEY = process.env.APP_STORE_CONNECT_PRIVATE_KEY;
const CI_KEY_ID =
  process.env.APP_STORE_CONNECT_KEY_IDENTIFIER ||
  process.env.APP_STORE_CONNECT_KEY_ID;
const CI_ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;

const LOCAL_KEY_PATH =
  process.env.ASC_KEY_PATH ||
  path.resolve(ROOT, ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const LOCAL_KEY_ID = process.env.ASC_KEY_ID || "8XWLD2B2RQ";
const LOCAL_ISSUER =
  process.env.ASC_ISSUER_ID || "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

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

function normalizePem(raw) {
  if (!raw) return raw;
  // Codemagic occasionally serializes the .p8 with literal \n escapes.
  if (raw.includes("\\n") && !raw.includes("\n")) {
    return raw.replace(/\\n/g, "\n");
  }
  return raw;
}

function signToken({ key, keyId, issuer }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuer,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const headerB = b64url(JSON.stringify(header));
  const payloadB = b64url(JSON.stringify(payload));
  const signingInput = `${headerB}.${payloadB}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  const derSig = signer.sign(key);
  const joseSig = derToJose(derSig);
  return `${signingInput}.${b64url(joseSig)}`;
}

function resolveAuth() {
  if (CI_KEY && CI_KEY_ID && CI_ISSUER) {
    return {
      key: normalizePem(CI_KEY),
      keyId: CI_KEY_ID,
      issuer: CI_ISSUER,
      mode: "ci",
    };
  }
  if (!fs.existsSync(LOCAL_KEY_PATH)) {
    throw new Error(
      `No ASC credentials found. Need either env vars (CI) or .p8 at ${LOCAL_KEY_PATH}.`
    );
  }
  return {
    key: fs.readFileSync(LOCAL_KEY_PATH, "utf8"),
    keyId: LOCAL_KEY_ID,
    issuer: LOCAL_ISSUER,
    mode: "local",
  };
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

async function main() {
  const auth = resolveAuth();
  console.log(`[1/4] Auth mode: ${auth.mode} (key ${auth.keyId})`);
  const token = signToken(auth);

  console.log(`[2/4] Looking up bundle ${BUNDLE_ID}...`);
  const lookup = await call(
    "GET",
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&include=bundleIdCapabilities&limit=200`,
    token
  );
  if (!lookup.ok) {
    console.error("      Lookup FAILED:", lookup.status, JSON.stringify(lookup.data));
    process.exit(1);
  }
  const bundle = (lookup.data.data || []).find(
    (b) => b.attributes?.identifier === BUNDLE_ID
  );
  if (!bundle) {
    console.error(`      Bundle ${BUNDLE_ID} not found in ASC. Run asc-create-app.mjs first.`);
    process.exit(1);
  }
  console.log(`      Bundle record id: ${bundle.id}`);

  const existingCapIds = (bundle.relationships?.bundleIdCapabilities?.data || []).map(
    (d) => d.id
  );
  const included = lookup.data.included || [];
  const existingCaps = included
    .filter((i) => i.type === "bundleIdCapabilities" && existingCapIds.includes(i.id))
    .map((i) => i.attributes?.capabilityType)
    .filter(Boolean);
  console.log(
    `      Existing capabilities: ${existingCaps.length ? existingCaps.join(", ") : "(none)"}`
  );

  if (existingCaps.includes(CAPABILITY)) {
    console.log(`[3/4] ${CAPABILITY} already enabled — no-op.`);
    console.log("[4/4] Done.");
    return;
  }

  console.log(`[3/4] Enabling ${CAPABILITY}...`);
  const enable = await call("POST", "/v1/bundleIdCapabilities", token, {
    data: {
      type: "bundleIdCapabilities",
      attributes: { capabilityType: CAPABILITY },
      relationships: {
        bundleId: {
          data: { type: "bundleIds", id: bundle.id },
        },
      },
    },
  });
  if (!enable.ok) {
    console.error(
      "      Enable FAILED:",
      enable.status,
      JSON.stringify(enable.data, null, 2)
    );
    process.exit(1);
  }
  console.log(`      ${CAPABILITY} enabled (record ${enable.data.data?.id}).`);
  console.log("[4/4] Done. Provisioning profile must be regenerated for this to take effect.");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
