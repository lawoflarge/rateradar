// CI variant of asc-revoke-distribution-certs.mjs:
// reads the ASC API key from env vars instead of .secrets/AuthKey_*.p8,
// so it works inside Codemagic (where the .p8 isn't in the repo, but the
// app_store_connect integration exposes the same key via env).
//
// Codemagic env vars from the `rateradar-asc` integration:
//   APP_STORE_CONNECT_PRIVATE_KEY     — raw .p8 contents (with BEGIN/END lines)
//   APP_STORE_CONNECT_KEY_IDENTIFIER  — e.g. "8XWLD2B2RQ"
//   APP_STORE_CONNECT_ISSUER_ID       — e.g. "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411"
//
// Same purpose as the local script: revoke every IOS_DISTRIBUTION cert
// so the next `fetch-signing-files --create` doesn't hit Apple's HTTP 409
// "You already have a current Distribution certificate or a pending
// certificate request" cap.
//
// Safe — does NOT affect installed TestFlight / App Store binaries; the
// cert is only used at build time. Codemagic's keychain dies at end of
// build anyway, so leaving stale certs around guarantees the next build
// will hit the 409.
//
// Usage (from codemagic.yaml):
//   node scripts/asc-revoke-distribution-certs-ci.mjs

import crypto from "node:crypto";

// Codemagic exposes these via the `integrations: app_store_connect:` hook.
// Older Codemagic CLI versions used `_KEY_ID` instead of `_KEY_IDENTIFIER`,
// so accept both for forward/backward compatibility.
const RAW_KEY = process.env.APP_STORE_CONNECT_PRIVATE_KEY;
const KEY_ID =
  process.env.APP_STORE_CONNECT_KEY_IDENTIFIER ||
  process.env.APP_STORE_CONNECT_KEY_ID;
const ISSUER_ID = process.env.APP_STORE_CONNECT_ISSUER_ID;

// Normalize the PEM. Codemagic has been observed serializing the .p8 in three
// different ways depending on how the integration was uploaded:
//   (a) Full PEM with real \n  — works as-is with crypto.createPrivateKey
//   (b) Full PEM with literal "\n" escape sequences — fails ERR_OSSL_UNSUPPORTED
//       because OpenSSL parses BEGIN/END as a single 1-line blob
//   (c) Just the base64 body, no BEGIN/END markers — same OpenSSL failure
// Build 25 attempt #3 hit case (b) or (c). Normalize both away.
function normalizePem(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  // (b) literal \n -> real newline
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");
  // (c) no BEGIN marker -> wrap as PKCS#8 PEM
  if (!s.includes("BEGIN")) {
    const b64 = s.replace(/\s+/g, "");
    s = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
  }
  return s;
}
const KEY = normalizePem(RAW_KEY);

// Diagnostic so future failures land me in the right case without leaking the
// secret. Print length + first/last 30 chars of normalized PEM (markers only).
if (KEY) {
  const first = KEY.slice(0, 30).replace(/\n/g, "\\n");
  const last = KEY.slice(-30).replace(/\n/g, "\\n");
  console.log(`PEM length=${KEY.length}  first=${first}…  last=…${last}`);
}

if (!RAW_KEY || !KEY_ID || !ISSUER_ID) {
  console.error(
    "Missing required env vars. Need APP_STORE_CONNECT_PRIVATE_KEY, " +
      "APP_STORE_CONNECT_KEY_IDENTIFIER, APP_STORE_CONNECT_ISSUER_ID. " +
      "These come from the Codemagic app_store_connect integration.",
  );
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeToken() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 60 * 15,
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const privateKey = crypto.createPrivateKey(KEY);
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(sig)}`;
}

async function api(token, method, pathSuffix) {
  const url = `https://api.appstoreconnect.apple.com${pathSuffix}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: r.status, ok: r.ok, body: json };
}

async function main() {
  // Generate the JWT inside main() so a PEM-parse failure flows into the
  // try/catch and is reported as a soft warning, not a build-killing throw.
  // We want the build to PROCEED to the signing step even if revoke fails —
  // if 0 stale certs exist anyway, signing succeeds. Better than dying here.
  const token = makeToken();
  const list = await api(token, "GET", "/v1/certificates?limit=200");
  if (!list.ok) {
    console.error("Failed to list certificates:", list.status);
    console.error(JSON.stringify(list.body, null, 2).slice(0, 600));
    process.exit(1);
  }

  const certs = list.body.data || [];
  const distCerts = certs.filter((c) => {
    const t = c.attributes?.certificateType;
    return t === "IOS_DISTRIBUTION" || t === "DISTRIBUTION";
  });

  console.log(`Total certs: ${certs.length}. iOS Distribution: ${distCerts.length}.`);
  if (distCerts.length === 0) {
    console.log("Nothing to revoke. Done.");
    return;
  }

  let revoked = 0;
  let failed = 0;
  for (const c of distCerts) {
    const r = await api(token, "DELETE", `/v1/certificates/${c.id}`);
    if (r.ok || r.status === 204) {
      console.log(`  revoked ${c.id}  (${c.attributes?.name})`);
      revoked++;
    } else {
      console.log(`  FAILED ${c.id}: HTTP ${r.status}`);
      failed++;
    }
  }
  console.log(`\nRevoked ${revoked}, failed ${failed}.`);
  // Don't fail the build on revoke errors — let signing step report its own
  // diagnostics if there's still a cert blocking. Just print.
}

main().catch((e) => {
  console.error("Revoke step soft-failed:", e?.message ?? e);
  console.error(
    "Continuing build — if 0 stale certs exist, signing succeeds anyway. " +
      "If signing fails with HTTP 409, the PEM normalization above needs another case.",
  );
  // Intentionally NOT process.exit(1) — we want the build to proceed to
  // Set up code signing rather than die here.
});
