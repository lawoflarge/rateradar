// Revokes ALL existing IOS_DISTRIBUTION certificates in App Store Connect
// so Codemagic can mint a fresh one whose private key it controls.
//
// Safe: revoking iOS Distribution certs does NOT affect already-installed
// TestFlight or App Store builds. It only prevents NEW builds from being
// signed with the revoked cert. We have no use for these certs anyway
// because the matching private keys live on Expo's EAS servers.
//
// Usage: node scripts/asc-revoke-distribution-certs.mjs
//        node scripts/asc-revoke-distribution-certs.mjs --dry-run
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_<ASC_KEY_ID>.p8");
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;

const DRY_RUN = process.argv.includes("--dry-run");

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

async function api(method, pathSuffix) {
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
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, ok: r.ok, body: json };
}

async function main() {
  // List all certificates, filter to iOS Distribution types client-side.
  const list = await api("GET", "/v1/certificates?limit=200");
  if (!list.ok) {
    console.error("Failed to list certificates:", list.status, JSON.stringify(list.body, null, 2));
    process.exit(1);
  }

  const certs = list.body.data || [];
  const distCerts = certs.filter((c) => {
    const t = c.attributes?.certificateType;
    return t === "IOS_DISTRIBUTION" || t === "DISTRIBUTION";
  });

  console.log(`Found ${certs.length} total certificates, ${distCerts.length} iOS Distribution.\n`);
  for (const c of distCerts) {
    const a = c.attributes || {};
    console.log(`  - id=${c.id}  type=${a.certificateType}  name=${a.name}  expires=${a.expirationDate}`);
  }
  console.log("");

  if (distCerts.length === 0) {
    console.log("No iOS Distribution certificates to revoke. Done.");
    return;
  }

  if (DRY_RUN) {
    console.log("[dry-run] Skipping revocation. Re-run without --dry-run to actually revoke.");
    return;
  }

  let revoked = 0;
  let failed = 0;
  for (const c of distCerts) {
    const r = await api("DELETE", `/v1/certificates/${c.id}`);
    if (r.ok || r.status === 204) {
      console.log(`  ✓ revoked ${c.id}  (${c.attributes?.name})`);
      revoked++;
    } else {
      console.log(`  ✗ failed ${c.id}: ${r.status} ${JSON.stringify(r.body)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${revoked} revoked, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
