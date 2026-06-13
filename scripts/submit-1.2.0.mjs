/**
 * Submit RateRadar appStoreVersion 1.2.0 for App Review via the ASC REST API.
 * The asc CLI exposes no submit verb (publish would re-upload), so this mints an
 * ES256 JWT from the team key and drives reviewSubmissions directly. Read-only
 * apart from the three review-submission mutations. Run: node scripts/submit-1.2.0.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";

const KEY_ID = "8XWLD2B2RQ";
const ISSUER = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768628917";
const VERSION_ID = "21907635-ad18-43cf-92b2-61df7dafab34";
const KEY_PATH = `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;

const pem = fs.readFileSync(KEY_PATH, "utf8");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = { iss: ISSUER, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.sign("sha256", Buffer.from(input), { key: pem, dsaEncoding: "ieee-p1363" });
  return `${input}.${sig.toString("base64url")}`;
}

const BASE = "https://api.appstoreconnect.apple.com";
async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}\n${text}`);
  return json;
}

// 1. Reuse an open reviewSubmission for this app+platform, else create one.
const existing = await api("GET",
  `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW&limit=10`);
let submissionId = existing.data?.[0]?.id;
if (submissionId) {
  console.log("Reusing open reviewSubmission", submissionId);
} else {
  const created = await api("POST", "/v1/reviewSubmissions", {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  submissionId = created.data.id;
  console.log("Created reviewSubmission", submissionId);
}

// 2. Add the 1.2.0 version as an item (ignore "already added" conflicts).
try {
  await api("POST", "/v1/reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
        appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
      },
    },
  });
  console.log("Added version", VERSION_ID, "to submission");
} catch (e) {
  if (/already|exists|409/i.test(String(e))) console.log("Version already on submission, continuing");
  else throw e;
}

// 3. Submit.
const submitted = await api("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
  data: { type: "reviewSubmissions", id: submissionId, attributes: { submitted: true } },
});
console.log("SUBMITTED. state =", submitted.data?.attributes?.state);
