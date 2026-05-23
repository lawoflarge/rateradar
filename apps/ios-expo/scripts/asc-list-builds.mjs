// Quick read-only check: lists the most recent builds in App Store Connect
// for the RateRadar app, plus their TestFlight processing state and group
// membership. Useful for verifying that a Codemagic upload actually landed.
//
// Usage: node scripts/asc-list-builds.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_<ASC_KEY_ID>.p8");
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;

// Resolve APP_ID from .secrets/asc-app-id.txt (written by asc-create-app.mjs).
// Override with ASC_APP_ID env var if needed.
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
async function api(pathSuffix) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${pathSuffix}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : {} };
}

const r = await api(
  `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=10&include=preReleaseVersion,buildBetaDetail`
);
if (r.status !== 200) {
  console.error("API error:", r.status, JSON.stringify(r.body, null, 2));
  process.exit(1);
}
const builds = r.body.data || [];
const included = r.body.included || [];
console.log(`Found ${builds.length} most recent builds for app ${APP_ID}:\n`);
for (const b of builds) {
  const a = b.attributes || {};
  const detailRel = b.relationships?.buildBetaDetail?.data;
  const detail = detailRel ? included.find((x) => x.type === "buildBetaDetails" && x.id === detailRel.id) : null;
  const beta = detail?.attributes || {};
  console.log(
    `  build=${a.version}  v=${a.preReleaseVersion?.attributes?.version || "?"}  state=${a.processingState}  uploaded=${a.uploadedDate}  beta=${beta.externalBuildState || "—"}/${beta.internalBuildState || "—"}`
  );
}
