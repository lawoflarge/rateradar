// Bootstrap App Store distribution signing on a fresh Mac via ASC API.
// Reuses the team distribution cert (Apple Distribution: Levin David Schwab)
// if already in the keychain; mints an IOS_APP_STORE profile for this bundle.
// Adapted from noseprint/apps/ios/scripts/asc-bootstrap-signing.mjs.
//
// Usage: node scripts/asc-bootstrap-signing.mjs

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const KEY_PATH = process.env.ASC_KEY_PATH || path.join(PROJECT_ROOT, ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const TEAM_ID = "R95M36AU2X";
const BUNDLE_ID = "com.lawoflarge.rateradar";
const PROFILE_NAME = "RateRadar AppStore Auto";
const OUT_DIR = path.join(PROJECT_ROOT, ".secrets", "signing");
const PROFILE_DIR = path.join(os.homedir(), "Library", "MobileDevice", "Provisioning Profiles");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

function b64url(b) { return Buffer.from(b).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, body: j };
}

function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }

(async () => {
  console.log("Bootstrap ASC signing for", BUNDLE_ID);

  // 1. Look up existing DISTRIBUTION cert in ASC (already minted by noseprint)
  const existingCerts = await api("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=50");
  if (!existingCerts.ok) {
    console.error("Failed to list certificates:", existingCerts.status, JSON.stringify(existingCerts.body));
    process.exit(1);
  }
  const certs = existingCerts.body.data || [];
  if (certs.length === 0) {
    console.error("No DISTRIBUTION certificates in this team. Run noseprint's bootstrap first.");
    process.exit(1);
  }
  certs.sort((a, b) => (b.attributes?.expirationDate || "").localeCompare(a.attributes?.expirationDate || ""));
  const cert = certs[0];
  const certId = cert.id;
  console.log(`• using DISTRIBUTION cert ${certId} (${cert.attributes?.displayName || cert.attributes?.name})`);

  // 2. Resolve bundleId resource (must already exist since v1.0 shipped)
  const bids = await api("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=5`);
  const bid = bids.body.data?.[0];
  if (!bid) { console.error(`No bundleId resource for ${BUNDLE_ID}`); process.exit(1); }
  console.log(`• bundleId resource: ${bid.id}`);

  // 3. Find or create App Store profile bound to this cert + bundleId
  const profs = await api("GET", `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=certificates,bundleId&limit=10`);
  let prof = profs.body.data?.find(p => p.attributes?.name === PROFILE_NAME && p.attributes?.profileType === "IOS_APP_STORE");
  if (prof) {
    const profCertIds = prof.relationships?.certificates?.data?.map(c => c.id) || [];
    if (!profCertIds.includes(certId)) {
      console.log(`• existing profile ${prof.id} doesn't reference our cert; deleting`);
      await api("DELETE", `/v1/profiles/${prof.id}`);
      prof = null;
    } else {
      console.log(`• reusing profile ${prof.id}`);
    }
  }
  if (!prof) {
    const createProf = await api("POST", "/v1/profiles", {
      data: {
        type: "profiles",
        attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bid.id } },
          certificates: { data: [{ type: "certificates", id: certId }] },
        },
      },
    });
    if (!createProf.ok) {
      console.error(`POST /v1/profiles failed: ${createProf.status}`);
      console.error(JSON.stringify(createProf.body, null, 2));
      process.exit(1);
    }
    prof = createProf.body.data;
    console.log(`✓ created profile ${prof.id}`);
  }

  // 4. Download profile content
  const profDetail = await api("GET", `/v1/profiles/${prof.id}`);
  const profContent = profDetail.body.data?.attributes?.profileContent;
  if (!profContent) { console.error("No profileContent in response"); process.exit(1); }
  const profBuf = Buffer.from(profContent, "base64");

  // 5. Extract UUID + install into the local provisioning profile directory
  const tmpProf = path.join(OUT_DIR, "profile.mobileprovision");
  fs.writeFileSync(tmpProf, profBuf);
  const plistXml = sh(`security cms -D -i "${tmpProf}"`);
  const uuidMatch = plistXml.match(/<key>UUID<\/key>\s*<string>([^<]+)<\/string>/);
  if (!uuidMatch) { console.error("No UUID in profile"); process.exit(1); }
  const uuid = uuidMatch[1];
  const installedPath = path.join(PROFILE_DIR, `${uuid}.mobileprovision`);
  fs.writeFileSync(installedPath, profBuf);
  console.log(`✓ installed profile UUID ${uuid}`);

  // 6. Summary for downstream archive
  fs.writeFileSync(path.join(OUT_DIR, "signing-info.json"), JSON.stringify({
    teamId: TEAM_ID, bundleId: BUNDLE_ID,
    certificateId: certId, profileId: prof.id,
    profileName: PROFILE_NAME, profileUUID: uuid, profilePath: installedPath,
  }, null, 2));
  console.log("\nSigning bootstrap complete.");
})().catch(e => { console.error("Fatal:", e); process.exit(1); });
