// Fills App Store metadata for RateRadar v1.0 via the ASC REST API.
// Idempotent — safe to re-run. PATCHes everything the public API allows.
//
// What this fills:
//   - App Info Localization (en-US): subtitle, privacyPolicyUrl
//   - App Info: primaryCategory + secondaryCategory
//   - App Store Version Localization (en-US, v1.0):
//       description, keywords, marketingUrl, supportUrl,
//       promotionalText, whatsNew
//   - Age Rating Declaration (4+ profile — no UGC, no ads, no contests)
//
// What this does NOT touch (web-only or fragile):
//   - Pricing & Availability (use asc-finalize-submission.mjs)
//   - App Privacy questionnaire (web-only — asc-browser-cdp.cjs + asc-do.cjs)
//   - Content Rights toggle (use asc-finalize-submission.mjs)
//   - Screenshots (asc-upload-screenshots.mjs)
//   - Build attachment to version (auto once a TestFlight build lands)
//
// Usage: node scripts/asc-fill-metadata.mjs
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

async function api(method, pathSuffix, body) {
  const url = `https://api.appstoreconnect.apple.com${pathSuffix}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, body: json, ok: r.ok };
}

function logResult(label, res) {
  const tag = res.ok ? "OK" : "FAIL";
  console.log(`[${tag} ${res.status}] ${label}`);
  if (!res.ok) console.log("  →", JSON.stringify(res.body, null, 2).slice(0, 800));
}

const META = {
  subtitle: "Fed & ECB Odds",
  privacyPolicyUrl: "https://rateradar-web.vercel.app/methodology",
  primaryCategory: "FINANCE",
  secondaryCategory: "NEWS",
  marketingUrl: "https://rateradar-web.vercel.app",
  supportUrl: "https://rateradar-web.vercel.app/about",
  promotionalText:
    "Live odds on the next Fed and ECB decisions, with 60 days of probability history. Free, ad-supported, no signup.",
  description: `RateRadar tracks the odds the market is putting on the next Fed and ECB rate decision — and shows you how those odds have shifted over the last 60 days.

Every probability is computed from real market data (Fed Funds Futures + €STR OIS) using the step-function decomposition documented in the methodology page. We don't scrape CME FedWatch or ECB Watch — we calculate from raw prices, and we keep history.

What you get:
• Live probability tables for every upcoming FOMC and ECB meeting
• 60-day historical charts showing how each outcome's odds have moved
• Most-likely-path view across the next 3 meetings (cumulative implied policy rate)
• Fed vs ECB divergence at a glance
• Implied rate curves through the year
• A clean, ad-supported, no-signup, no-subscription product

For retail traders, finance students, and anyone who likes watching central banks the way some people watch fantasy football.

Methodology is fully published. Numbers update at least twice every business day plus on meeting days. The history view is the differentiator — most other rate trackers only show today's snapshot. RateRadar shows you the path of expectations.

No accounts, no tracking, no subscription tiers. We make money from broker affiliate links and a banner ad. That's it.`,
  // Keywords: 100-char limit, comma-separated, no spaces around commas.
  // Current: 86 chars.
  keywords: "fed,ecb,rates,interest,probability,fomc,trading,macro,fred,bonds,markets,futures",
  whatsNew: `Welcome to RateRadar.

Live odds on every upcoming Fed and ECB rate decision, with 60 days of probability history so you can see how expectations have moved.

Free, ad-supported, no signup.`,
  copyright: "© 2026 Levin Schwab",
  reviewContactFirstName: "Levin",
  reviewContactLastName: "Schwab",
  reviewContactPhone: "+49 157 379 65607",
  reviewContactEmail: "levin.schwab@gmx.de",
  reviewNotes: `No login required — RateRadar is an anonymous public market data viewer.
Push notifications are opt-in (asked once at first launch).
No in-app purchases, no subscriptions.
Contact: levin.schwab@gmx.de.`,
};

(async () => {
  console.log(`ASC metadata fill — App ${APP_ID}\n`);

  // 1. Resolve appInfo + version + their localization IDs
  const infos = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.body.data?.find(
    (i) => i.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION" || i.attributes?.state === "PREPARE_FOR_SUBMISSION"
  );
  if (!info) throw new Error("No editable appInfo found.");
  console.log(`appInfo: ${info.id}`);

  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const version = versions.body.data?.find(
    (v) => v.attributes?.versionString === "1.0" && v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION"
  );
  if (!version) throw new Error("No editable v1.0 appStoreVersion found.");
  console.log(`appStoreVersion: ${version.id}`);

  const infoLocs = await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
  const infoLoc = infoLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (!infoLoc) throw new Error("No en-US appInfoLocalization.");
  console.log(`appInfoLocalization (en-US): ${infoLoc.id}`);

  const verLocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  const verLoc = verLocs.body.data?.find((l) => l.attributes?.locale === "en-US");
  if (!verLoc) throw new Error("No en-US appStoreVersionLocalization.");
  console.log(`appStoreVersionLocalization (en-US): ${verLoc.id}\n`);

  // 2. PATCH AppInfo Localization (subtitle, privacy URL)
  logResult(
    "PATCH appInfoLocalization (subtitle, privacyPolicyUrl)",
    await api("PATCH", `/v1/appInfoLocalizations/${infoLoc.id}`, {
      data: {
        type: "appInfoLocalizations",
        id: infoLoc.id,
        attributes: {
          subtitle: META.subtitle,
          privacyPolicyUrl: META.privacyPolicyUrl,
        },
      },
    })
  );

  // 3. PATCH AppInfo (primary + secondary category relationships)
  logResult(
    "PATCH appInfo (primaryCategory + secondaryCategory)",
    await api("PATCH", `/v1/appInfos/${info.id}`, {
      data: {
        type: "appInfos",
        id: info.id,
        relationships: {
          primaryCategory: { data: { type: "appCategories", id: META.primaryCategory } },
          secondaryCategory: { data: { type: "appCategories", id: META.secondaryCategory } },
        },
      },
    })
  );

  // 4. PATCH AppStoreVersion Localization (description, keywords, URLs, promo)
  // whatsNew skipped — only editable once a build is attached to the version.
  logResult(
    "PATCH appStoreVersionLocalization (description, keywords, urls, promo)",
    await api("PATCH", `/v1/appStoreVersionLocalizations/${verLoc.id}`, {
      data: {
        type: "appStoreVersionLocalizations",
        id: verLoc.id,
        attributes: {
          description: META.description,
          keywords: META.keywords,
          marketingUrl: META.marketingUrl,
          supportUrl: META.supportUrl,
          promotionalText: META.promotionalText,
        },
      },
    })
  );

  // Try whatsNew separately so a STATE_ERROR (no build attached) doesn't kill everything else.
  const whatsNewRes = await api("PATCH", `/v1/appStoreVersionLocalizations/${verLoc.id}`, {
    data: {
      type: "appStoreVersionLocalizations",
      id: verLoc.id,
      attributes: { whatsNew: META.whatsNew },
    },
  });
  if (whatsNewRes.ok) {
    console.log("[OK 200] PATCH appStoreVersionLocalization (whatsNew)");
  } else {
    // For first releases (v1.0), Apple disables "What's New" — only used for v1.0.1+ updates.
    console.log(`[SKIP ${whatsNewRes.status}] whatsNew not editable for first release v1.0 — Apple uses description instead`);
  }

  // 5b. PATCH appStoreVersion attributes (copyright, usesIdfa)
  logResult(
    "PATCH appStoreVersion (copyright, usesIdfa=false)",
    await api("PATCH", `/v1/appStoreVersions/${version.id}`, {
      data: {
        type: "appStoreVersions",
        id: version.id,
        attributes: {
          copyright: META.copyright,
          usesIdfa: false,
        },
      },
    })
  );

  // 5c. Create or update App Store Review Detail (contact + notes)
  const reviewRel = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`);
  if (reviewRel.body?.data?.id) {
    logResult(
      "PATCH appStoreReviewDetail (contact + notes)",
      await api("PATCH", `/v1/appStoreReviewDetails/${reviewRel.body.data.id}`, {
        data: {
          type: "appStoreReviewDetails",
          id: reviewRel.body.data.id,
          attributes: {
            contactFirstName: META.reviewContactFirstName,
            contactLastName: META.reviewContactLastName,
            contactPhone: META.reviewContactPhone,
            contactEmail: META.reviewContactEmail,
            notes: META.reviewNotes,
          },
        },
      })
    );
  } else {
    logResult(
      "POST appStoreReviewDetail (contact + notes)",
      await api("POST", `/v1/appStoreReviewDetails`, {
        data: {
          type: "appStoreReviewDetails",
          attributes: {
            contactFirstName: META.reviewContactFirstName,
            contactLastName: META.reviewContactLastName,
            contactPhone: META.reviewContactPhone,
            contactEmail: META.reviewContactEmail,
            notes: META.reviewNotes,
          },
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
          },
        },
      })
    );
  }

  // 6. Attach the latest VALID build to the v1.0 App Store Version
  const builds = await api("GET", `/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`);
  const latestValid = builds.body.data?.find((b) => b.attributes?.processingState === "VALID");
  if (latestValid) {
    console.log(`\nAttaching build ${latestValid.id} (v${latestValid.attributes.version}) to appStoreVersion ${version.id}…`);
    logResult(
      "PATCH appStoreVersion → relationships.build",
      await api("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, {
        data: { type: "builds", id: latestValid.id },
      })
    );
  } else {
    console.log("\nNo VALID builds found — skipping build attachment.");
  }

  // 5. PATCH Age Rating Declaration on appInfo.
  // RateRadar is a clean finance/news data viewer — no UGC, no ads-content,
  // no mature themes. 4+ profile.
  logResult(
    "PATCH ageRatingDeclaration (4+ profile)",
    await api("PATCH", `/v1/ageRatingDeclarations/${info.id}`, {
      data: {
        type: "ageRatingDeclarations",
        id: info.id,
        attributes: {
          violenceCartoonOrFantasy: "NONE",
          violenceRealistic: "NONE",
          violenceRealisticProlongedGraphicOrSadistic: "NONE",
          profanityOrCrudeHumor: "NONE",
          sexualContentOrNudity: "NONE",
          sexualContentGraphicAndNudity: "NONE",
          horrorOrFearThemes: "NONE",
          matureOrSuggestiveThemes: "NONE",
          medicalOrTreatmentInformation: "NONE",
          alcoholTobaccoOrDrugUseOrReferences: "NONE",
          gamblingSimulated: "NONE",
          contests: "NONE",
          gunsOrOtherWeapons: "NONE",
          healthOrWellnessTopics: false,
          advertising: false,
          gambling: false,
          unrestrictedWebAccess: false,
          lootBox: false,
          messagingAndChat: false,
          userGeneratedContent: false,
          parentalControls: false,
          kidsAgeBand: null,
          ageAssurance: false,
        },
      },
    })
  );

  console.log("\nDone. Re-run scripts/asc-list-builds.mjs to verify build state.");
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
