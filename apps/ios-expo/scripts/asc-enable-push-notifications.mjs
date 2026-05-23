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
 *
 * Build #3 (commit 02e45fa) hit this. Fix: enable PUSH_NOTIFICATIONS on the
 * bundle id ONCE via this script, then re-run the build. The capability
 * persists in ASC across builds.
 *
 * Idempotent — checks existing capabilities first, no-op if already enabled.
 *
 * Auth modes:
 *   - Local: reads .p8 from `.secrets/AuthKey_<ASC_KEY_ID>.p8`.
 *   - CI: reads APP_STORE_CONNECT_PRIVATE_KEY / _KEY_IDENTIFIER / _ISSUER_ID
 *         env vars injected by the Codemagic Apple Developer Portal
 *         integration. Same PEM normalization + signing logic as
 *         `asc-revoke-distribution-certs-ci.mjs` (handles all three of
 *         Codemagic's .p8 serialization quirks).
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

const CI_RAW_KEY = process.env.APP_STORE_CONNECT_PRIVATE_KEY;
const CI_KEY_ID =
  process.env.APP_STORE_CONNECT_KEY_IDENTIFIER ||
  process.env.APP_STORE_CONNECT_KEY_ID;
const CI_ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;

const LOCAL_KEY_PATH =
  process.env.ASC_KEY_PATH ||
  path.resolve(ROOT, ".secrets", "AuthKey_<ASC_KEY_ID>.p8");
const LOCAL_KEY_ID = process.env.ASC_KEY_ID;
const LOCAL_ISSUER =
  process.env.ASC_ISSUER_ID || process.env.ASC_ISSUER_ID;

// Resolve and normalize the PEM. Codemagic's app_store_connect integration
// can expose APP_STORE_CONNECT_PRIVATE_KEY in FOUR different formats
// depending on Codemagic version and how the .p8 was uploaded:
//   (0) `@file:<path>` — file path reference (Codemagic CLI convention).
//       The integration writes the .p8 to disk and exposes the path with
//       an `@file:` prefix. Build #6 hit this — diagnostic showed
//       "first=...@f… last=...p8...".
//   (a) Full PEM with real \n — works as-is with crypto.createPrivateKey.
//   (b) Full PEM with literal "\n" escape sequences — fails OpenSSL.
//   (c) Just the base64 body, no BEGIN/END markers — fails OpenSSL.
// Build #5 hit (b) or (c); build #6 hit (0). Handle all four.
function resolvePem(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  // (0) @file: prefix → load the actual key contents from disk
  if (s.startsWith("@file:")) {
    const p = s.slice("@file:".length);
    s = fs.readFileSync(p, "utf8").trim();
  } else if (s.startsWith("@env:")) {
    const v = s.slice("@env:".length);
    s = (process.env[v] || "").trim();
  }
  // (b) literal \n → real newline
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");
  // (c) no BEGIN marker → wrap as PKCS#8 PEM envelope
  if (!s.includes("BEGIN")) {
    const b64 = s.replace(/\s+/g, "");
    s = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
  }
  return s;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeToken({ keyPem, keyId, issuer }) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    iat: now,
    exp: now + 60 * 15,
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // Use crypto.sign with dsaEncoding=ieee-p1363 to get JOSE-format signature
  // directly. Same approach as asc-revoke-distribution-certs-ci.mjs.
  const privateKey = crypto.createPrivateKey(keyPem);
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(sig)}`;
}

function resolveAuth() {
  if (CI_RAW_KEY && CI_KEY_ID && CI_ISSUER) {
    const keyPem = resolvePem(CI_RAW_KEY);
    // Diagnostic so future failures land in the right case without leaking
    // the secret. Mirrors asc-revoke-distribution-certs-ci.mjs.
    const first = keyPem.slice(0, 30).replace(/\n/g, "\\n");
    const last = keyPem.slice(-30).replace(/\n/g, "\\n");
    console.log(`PEM length=${keyPem.length}  first=${first}…  last=…${last}`);
    return { keyPem, keyId: CI_KEY_ID, issuer: CI_ISSUER, mode: "ci" };
  }
  if (!fs.existsSync(LOCAL_KEY_PATH)) {
    throw new Error(
      `No ASC credentials found. Need either env vars (CI) or .p8 at ${LOCAL_KEY_PATH}.`
    );
  }
  return {
    keyPem: fs.readFileSync(LOCAL_KEY_PATH, "utf8"),
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
  const token = makeToken(auth);

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
