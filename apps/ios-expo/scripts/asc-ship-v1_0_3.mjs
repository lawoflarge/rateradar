// Ship RateRadar v1.0.3 via the ASC REST API — staged + idempotent.
//
// v1.0.3 = data-engine upgrade (real FED/ECB data) + new D1 screenshots + EN/DE ASO.
// Reuses build 4 (no native change). Copy is the staged set in ASO-v1_0_3.md.
//
// Stages (argv[2]):
//   inspect  (default) — READ ONLY: dump app state (versions, build, locales, shots).
//   apply              — create/find v1.0.3, attach VALID build, set en-US+de-DE
//                        metadata, REPLACE iPhone 6.9/6.5 + iPad screenshots with D1,
//                        set releaseType MANUAL.  Does NOT submit.
//   submit             — apply, then create reviewSubmission + item + submit.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID. Key at .secrets/AuthKey_${ASC_KEY_ID}.p8.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", `AuthKey_${KEY_ID}.p8`);
const APP_ID = (fs.readFileSync(path.resolve(__dirname, "..", ".secrets", "asc-app-id.txt"), "utf8").match(/^ASC_APP_ID=(\S+)/m) || [])[1];
const STAGE = process.argv[2] || "inspect";
const VERSION_STRING = "1.0.3";
const SHOTS_DIR = path.resolve(__dirname, "..", "assets", "screenshots");
const SHOT_FILES = ["01-hero.png", "02-outcomes.png", "03-path.png", "04-divergence.png", "05-curve.png"];
const DISPLAYS = [
  { dir: "6.9", type: "APP_IPHONE_67", w: 1290, h: 2796 },
  { dir: "6.5", type: "APP_IPHONE_65", w: 1242, h: 2688 },
  { dir: "ipad-13", type: "APP_IPAD_PRO_3GEN_129", w: 2064, h: 2752, optional: true },
];

if (!KEY_ID || !ISSUER_ID) { console.error("Set ASC_KEY_ID and ASC_ISSUER_ID."); process.exit(1); }
if (!APP_ID) { console.error("No APP_ID in .secrets/asc-app-id.txt."); process.exit(1); }

const META = {
  enUS: {
    subtitle: "Rate decision odds & history",
    keywords: "interest,cut,hike,fomc,future,probability,forecast,policy,bps,easing,tracker,monetary,inflation",
    promotionalText: "Real, market-implied odds for every upcoming Fed and ECB rate decision - recomputed daily from futures, with the full 60-day history. Never scraped.",
    description: `RateRadar tracks the market-implied probability of every upcoming Federal Reserve (Fed) and European Central Bank (ECB) interest-rate decision - and how those odds have moved over the last 60 days.

WHAT YOU GET
- Every outcome, every meeting: hold, cut, or hike, with a clean probability for each.
- The most-likely rate path, chained meeting by meeting.
- The implied forward-rate curve, priced from real market data.
- Fed vs ECB divergence at a glance.
- Historical tracking: odds snapshotted daily and kept, so you see the shift, not just today.

HOW IT WORKS
We compute our own numbers from 30-Day Fed Funds Futures and STR/DFR data using the published step-function decomposition. We never scrape CME FedWatch or ECB Watch. The full method is in the app (Methodology), versioned so you can trust the history.

Built for retail first: finance terms are explained, not assumed.`,
    whatsNew: `Real-data engine upgrade.

Every Fed and ECB probability is now computed live from real market data (Fed Funds futures + ECB DFR/STR), with our rewritten methodology (v1.2.0) - no more placeholder numbers - plus refreshed, on-brand visuals.`,
  },
  deDE: {
    subtitle: "Zins-Prognose & Verlauf",
    keywords: "ezb,leitzins,zinssenkung,zinserhöhung,fomc,notenbank,geldpolitik,wahrscheinlichkeit,inflation",
    promotionalText: "Echte, marktbasierte Wahrscheinlichkeiten für jede anstehende Fed- und ECB-Zinsentscheidung - täglich neu berechnet, mit 60-Tage-Verlauf. Nie gescrapt.",
    description: `RateRadar zeigt die marktbasierte Wahrscheinlichkeit jeder anstehenden Zinsentscheidung der US-Notenbank (Fed) und der Europäischen Zentralbank (ECB) - und wie sich diese Chancen über die letzten 60 Tage verschoben haben.

DAS BIETET DIE APP
- Jedes Ergebnis, jede Sitzung: halten, senken oder erhöhen, mit klarer Wahrscheinlichkeit.
- Der wahrscheinlichste Zinspfad, Sitzung für Sitzung verkettet.
- Die implizite Zinskurve, aus echten Marktdaten abgeleitet.
- Fed vs. ECB: die Divergenz auf einen Blick.
- Historischer Verlauf: Wahrscheinlichkeiten werden täglich gespeichert.

SO FUNKTIONIERT ES
Wir berechnen alle Zahlen selbst aus Fed-Funds-Futures und STR/DFR-Daten mit der veröffentlichten Step-Function-Methode. Wir scrapen niemals CME FedWatch oder ECB Watch. Die vollständige Methodik ist in der App hinterlegt und versioniert.`,
    whatsNew: `Echtdaten-Upgrade der Engine.

Jede Fed- und ECB-Wahrscheinlichkeit wird jetzt live aus echten Marktdaten berechnet (Fed-Funds-Futures + ECB DFR/STR), mit unserer überarbeiteten Methodik (v1.2.0) - keine Platzhalterzahlen mehr - plus aufgefrischte Visuals.`,
  },
};

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function makeToken() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 18, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}
const token = makeToken();
async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: r.status, body: json, ok: r.ok };
}
function must(res, label) {
  if (!res.ok) { console.error(`[FAIL ${res.status}] ${label}\n  ${JSON.stringify(res.body).slice(0, 600)}`); throw new Error(label); }
  console.log(`[OK ${res.status}] ${label}`);
  return res;
}

async function findVersion() {
  const vs = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=20`);
  return (vs.body.data || []).find((v) => v.attributes?.versionString === VERSION_STRING);
}
async function validBuild() {
  const b = await api("GET", `/v1/builds?filter[app]=${APP_ID}&limit=20&sort=-uploadedDate`);
  return (b.body.data || []).find((x) => x.attributes?.processingState === "VALID");
}

async function inspect() {
  console.log(`\n=== ASC inspect — app ${APP_ID} ===`);
  const vs = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=20`);
  for (const v of vs.body.data || []) {
    console.log(`  version ${v.attributes.versionString} — ${v.attributes.appStoreState} (id ${v.id})`);
  }
  const b = await validBuild();
  console.log(`  latest VALID build: ${b ? `v${b.attributes.version} (id ${b.id})` : "NONE"}`);
  const v103 = await findVersion();
  if (v103) {
    const locs = await api("GET", `/v1/appStoreVersions/${v103.id}/appStoreVersionLocalizations`);
    console.log(`  v${VERSION_STRING} locales: ${(locs.body.data || []).map((l) => l.attributes.locale).join(", ") || "none"}`);
    for (const loc of locs.body.data || []) {
      const sets = await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
      for (const s of sets.body.data || []) {
        const shots = await api("GET", `/v1/appScreenshotSets/${s.id}/appScreenshots`);
        console.log(`    [${loc.attributes.locale}] ${s.attributes.screenshotDisplayType}: ${(shots.body.data || []).length} shots`);
      }
    }
  } else {
    console.log(`  v${VERSION_STRING}: does NOT exist yet`);
  }
}

async function ensureVersion() {
  let v = await findVersion();
  if (v && v.attributes.appStoreState !== "PREPARE_FOR_SUBMISSION" && v.attributes.appStoreState !== "DEVELOPER_REJECTED") {
    console.log(`v${VERSION_STRING} exists in state ${v.attributes.appStoreState} (not editable) — using as-is`);
    return v;
  }
  if (!v) {
    v = must(await api("POST", `/v1/appStoreVersions`, {
      data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: VERSION_STRING },
        relationships: { app: { data: { type: "apps", id: APP_ID } } } },
    }), `create appStoreVersion ${VERSION_STRING}`).body.data;
  } else {
    console.log(`v${VERSION_STRING} already editable (id ${v.id})`);
  }
  const b = await validBuild();
  if (b) {
    const ba = await api("PATCH", `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: b.id } });
    console.log(ba.ok ? `[OK] attached build v${b.attributes.version}`
      : `[WARN ${ba.status}] build v${b.attributes.version} not attachable — a ${VERSION_STRING} build is required (build 4 is a 1.0.2 binary). Continuing with metadata + screenshots.`);
  }
  must(await api("PATCH", `/v1/appStoreVersions/${v.id}`, {
    data: { type: "appStoreVersions", id: v.id, attributes: { releaseType: "MANUAL", usesIdfa: false } },
  }), "set releaseType=MANUAL");
  return v;
}

async function ensureLocalization(versionId, locale, m) {
  const locs = await api("GET", `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  let loc = (locs.body.data || []).find((l) => l.attributes.locale === locale);
  if (!loc) {
    loc = must(await api("POST", `/v1/appStoreVersionLocalizations`, {
      data: { type: "appStoreVersionLocalizations", attributes: { locale },
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } } },
    }), `create localization ${locale}`).body.data;
  }
  const attrs = { description: m.description, keywords: m.keywords, promotionalText: m.promotionalText,
    marketingUrl: "https://rateradar-web.vercel.app", supportUrl: "https://rateradar-web.vercel.app/about" };
  must(await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: attrs },
  }), `metadata ${locale} (desc/keywords/promo/urls)`);
  // whatsNew only valid once a build is attached.
  const wn = await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew: m.whatsNew } } });
  console.log(wn.ok ? `[OK] whatsNew ${locale}` : `[skip ${wn.status}] whatsNew ${locale}`);
  return loc;
}

async function ensureSubtitle(locale, subtitle) {
  // subtitle lives on appInfoLocalization (per-locale), not the version localization.
  const infos = await api("GET", `/v1/apps/${APP_ID}/appInfos`);
  const info = (infos.body.data || []).find((i) => ["PREPARE_FOR_SUBMISSION", "READY_FOR_DISTRIBUTION", "READY_FOR_SALE"].includes(i.attributes?.appStoreState || i.attributes?.state) ) || infos.body.data?.[0];
  if (!info) { console.log(`[skip] no appInfo for subtitle ${locale}`); return; }
  const ilocs = await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
  let iloc = (ilocs.body.data || []).find((l) => l.attributes.locale === locale);
  if (!iloc) {
    const created = await api("POST", `/v1/appInfoLocalizations`, {
      data: { type: "appInfoLocalizations", attributes: { locale, name: "RateRadar: Fed & ECB", subtitle },
        relationships: { appInfo: { data: { type: "appInfos", id: info.id } } } } });
    if (created.ok) { console.log(`[OK] appInfoLocalization ${locale} created + subtitle`); return; }
    console.log(`[skip ${created.status}] create appInfoLocalization ${locale}: ${JSON.stringify(created.body).slice(0,200)}`); return;
  }
  const r = await api("PATCH", `/v1/appInfoLocalizations/${iloc.id}`, {
    data: { type: "appInfoLocalizations", id: iloc.id, attributes: { subtitle } } });
  console.log(r.ok ? `[OK] subtitle ${locale}` : `[skip ${r.status}] subtitle ${locale}`);
}

async function replaceScreenshots(localizationId) {
  const existing = await api("GET", `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`);
  const byType = {};
  for (const s of existing.body.data || []) byType[s.attributes.screenshotDisplayType] = s.id;
  for (const d of DISPLAYS) {
    try {
      let setId = byType[d.type];
      if (!setId) {
        setId = must(await api("POST", `/v1/appScreenshotSets`, {
          data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: d.type },
            relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: localizationId } } } },
        }), `create set ${d.type}`).body.data.id;
      } else {
        const cur = await api("GET", `/v1/appScreenshotSets/${setId}/appScreenshots`);
        for (const sh of cur.body.data || []) await api("DELETE", `/v1/appScreenshots/${sh.id}`);
        console.log(`  cleared ${(cur.body.data || []).length} old shots in ${d.type}`);
      }
      for (const fn of SHOT_FILES) {
        const fp = path.join(SHOTS_DIR, d.dir, fn);
        const buf = fs.readFileSync(fp);
        const reserved = must(await api("POST", `/v1/appScreenshots`, {
          data: { type: "appScreenshots", attributes: { fileName: fn, fileSize: buf.length },
            relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } } } },
        }), `reserve ${d.type}/${fn}`).body.data;
        for (const op of reserved.attributes.uploadOperations) {
          const headers = {}; for (const h of op.requestHeaders) headers[h.name] = h.value;
          const put = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
          if (!put.ok) throw new Error(`PUT ${d.type}/${fn} ${put.status}`);
        }
        const md5 = crypto.createHash("md5").update(buf).digest("hex");
        must(await api("PATCH", `/v1/appScreenshots/${reserved.id}`, {
          data: { type: "appScreenshots", id: reserved.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
        }), `commit ${d.type}/${fn}`);
      }
    } catch (e) {
      if (d.optional) { console.log(`  [iPad ${d.type} skipped: ${e.message} — old iPad shots carry over]`); }
      else throw e;
    }
  }
}

async function apply() {
  console.log(`\n=== ASC apply v${VERSION_STRING} ===`);
  const v = await ensureVersion();
  await ensureSubtitle("en-US", META.enUS.subtitle);
  await ensureSubtitle("de-DE", META.deDE.subtitle);
  const enLoc = await ensureLocalization(v.id, "en-US", META.enUS);
  await ensureLocalization(v.id, "de-DE", META.deDE);
  console.log("\n-- screenshots (en-US, primary) --");
  await replaceScreenshots(enLoc.id);
  return v;
}

async function submit(v) {
  console.log(`\n=== ASC submit v${VERSION_STRING} ===`);
  // reuse an open reviewSubmission if one exists, else create.
  const open = await api("GET", `/v1/apps/${APP_ID}/reviewSubmissions?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5`);
  let sub = (open.body.data || [])[0];
  if (!sub) {
    sub = must(await api("POST", `/v1/reviewSubmissions`, {
      data: { type: "reviewSubmissions", attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } } },
    }), "create reviewSubmission").body.data;
  } else console.log(`reusing reviewSubmission ${sub.id} (${sub.attributes.state})`);
  const item = await api("POST", `/v1/reviewSubmissionItems`, {
    data: { type: "reviewSubmissionItems",
      relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: v.id } } } } });
  console.log(item.ok ? `[OK] added v${VERSION_STRING} to submission` : `[item ${item.status}] ${JSON.stringify(item.body).slice(0,300)}`);
  must(await api("PATCH", `/v1/reviewSubmissions/${sub.id}`, {
    data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } },
  }), "SUBMIT for review");
}

(async () => {
  console.log(`Stage: ${STAGE}  | app ${APP_ID} | key ${KEY_ID}`);
  if (STAGE === "inspect") { await inspect(); }
  else if (STAGE === "apply") { await apply(); console.log("\nApply done (NOT submitted). Re-run inspect to verify, then `submit`."); }
  else if (STAGE === "submit") { const v = await apply(); await submit(v); console.log("\nSubmitted. Verify with inspect."); }
  else { console.error(`Unknown stage ${STAGE}`); process.exit(1); }
  await inspect();
})().catch((e) => { console.error("Fatal:", e.message || e); process.exit(1); });
