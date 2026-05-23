/**
 * Add Levin as an internal tester for RateRadar and attach build #1 to the
 * auto-created "App Store Connect Users" group so it shows up in TestFlight
 * on his iPhone.
 *
 * Why this exists: Apple separates ASC admin access from TestFlight tester
 * access. A new app has no testers by default. Even the team admin needs to
 * be explicitly enrolled in an internal beta group AND that group must have
 * the build attached, before the build appears in the TestFlight iPhone app.
 *
 * Steps:
 *   1. JWT auth (local .p8).
 *   2. Find the default "App Store Connect Users" internal beta group for app
 *      6768628917 (Apple auto-creates it; if missing, create it).
 *   3. Ensure Levin is a tester in that group (idempotent).
 *   4. Attach build #1 to the group via betaGroupsBuildSubmission.
 *
 * Idempotent — safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = "6768628917";
const TESTER_EMAIL = process.env.ASC_TESTER_EMAIL;
const TESTER_FIRST = "Levin";
const TESTER_LAST = "Schwab";

const KEY_PATH = path.resolve(ROOT, ".secrets", "AuthKey_<ASC_KEY_ID>.p8");
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const API = "https://api.appstoreconnect.apple.com";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
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
  const privateKey = crypto.createPrivateKey(fs.readFileSync(KEY_PATH, "utf8"));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(sig)}`;
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
  console.log(`[1/5] Auth (key ${KEY_ID})`);
  const token = makeToken();

  console.log(`[2/5] Find/create internal beta group for app ${APP_ID}...`);
  const groupsRes = await call(
    "GET",
    `/v1/apps/${APP_ID}/betaGroups?limit=200`,
    token
  );
  if (!groupsRes.ok) {
    console.error("      FAIL list groups:", groupsRes.status, JSON.stringify(groupsRes.data));
    process.exit(1);
  }
  const allGroups = groupsRes.data.data || [];
  console.log(`      Found ${allGroups.length} beta group(s):`);
  for (const g of allGroups) {
    console.log(
      `        - ${g.id} name="${g.attributes?.name}" internal=${g.attributes?.isInternalGroup}`
    );
  }
  // Prefer internal group; fall back to any group.
  let group =
    allGroups.find((g) => g.attributes?.isInternalGroup === true) || allGroups[0];
  if (group) {
    console.log(`      Internal group exists: ${group.id} "${group.attributes?.name}"`);
  } else {
    console.log("      No internal group exists. Creating 'Internal Testers'...");
    const create = await call("POST", "/v1/betaGroups", token, {
      data: {
        type: "betaGroups",
        attributes: { name: "Internal Testers" },
        relationships: {
          app: { data: { type: "apps", id: APP_ID } },
        },
      },
    });
    if (!create.ok) {
      console.error("      Create FAILED:", create.status, JSON.stringify(create.data, null, 2));
      process.exit(1);
    }
    group = create.data.data;
    console.log(`      Created group: ${group.id}`);
  }

  console.log(`[3/5] Lookup tester ${TESTER_EMAIL}...`);
  const lookup = await call(
    "GET",
    `/v1/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}&limit=10`,
    token
  );
  let tester = (lookup.data.data || [])[0];
  if (tester) {
    console.log(`      Tester exists: ${tester.id}`);
  } else {
    console.log("      Creating tester...");
    const create = await call("POST", "/v1/betaTesters", token, {
      data: {
        type: "betaTesters",
        attributes: {
          firstName: TESTER_FIRST,
          lastName: TESTER_LAST,
          email: TESTER_EMAIL,
        },
        relationships: {
          betaGroups: { data: [{ type: "betaGroups", id: group.id }] },
        },
      },
    });
    if (!create.ok) {
      console.error("      Create tester FAILED:", create.status, JSON.stringify(create.data, null, 2));
      process.exit(1);
    }
    tester = create.data.data;
    console.log(`      Created tester: ${tester.id}`);
  }

  console.log("[4/5] Ensure tester is in group...");
  const enroll = await call(
    "POST",
    `/v1/betaGroups/${group.id}/relationships/betaTesters`,
    token,
    { data: [{ type: "betaTesters", id: tester.id }] }
  );
  if (enroll.ok || enroll.status === 409 || enroll.status === 204) {
    console.log("      Tester is in group (or was already).");
  } else {
    console.warn("      enroll non-fatal:", enroll.status, JSON.stringify(enroll.data));
  }

  console.log("[5/5] Find latest build and attach to group...");
  const buildsRes = await call(
    "GET",
    `/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`,
    token
  );
  const build = (buildsRes.data.data || [])[0];
  if (!build) {
    console.error("      No builds in ASC yet.");
    process.exit(1);
  }
  console.log(
    `      Latest build: ${build.id} v=${build.attributes?.version} state=${build.attributes?.processingState}`
  );

  // Beta App Review (internal testers don't actually need this since they're
  // internal, but the build must be made available to the group via the
  // build relationship of betaGroups.
  const attach = await call(
    "POST",
    `/v1/betaGroups/${group.id}/relationships/builds`,
    token,
    { data: [{ type: "builds", id: build.id }] }
  );
  if (attach.ok || attach.status === 409 || attach.status === 204) {
    console.log("      Build attached to group.");
  } else {
    console.warn("      attach non-fatal:", attach.status, JSON.stringify(attach.data));
  }

  console.log("");
  console.log("Done. The build should appear in the TestFlight iPhone app within");
  console.log("~1-3 minutes. An invite email may also arrive at:", TESTER_EMAIL);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
