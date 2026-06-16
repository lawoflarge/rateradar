// RateRadar App Store "Glow-Up" — one-command orchestrator.
//
// Pipeline:
//   Stage A  capture   native SwiftUI screens via simulator + AXe   (opt-in: --capture)
//   Stage B  composite premium dark-canvas posters @ 1290x2796      (compositor.mjs)
//   Stage C  stage     copy frames into out/asc/<locale>/ for ASC fan-out
//   Stage D  validate  `asc screenshots validate` (dims/order/hidden-file preflight)
//   Stage E  upload    `asc screenshots upload --replace` to an editable App Store version (opt-in)
//
// The captured app screens live in ./screens and are committed, so by default we
// SKIP capture and recomposite from them (fast, deterministic). Pass --capture to
// rebuild + re-screenshot the live app first.
//
// Usage:
//   node build.mjs --app rateradar                      # composite + validate
//   node build.mjs --app rateradar --capture            # re-capture native screens first
//   node build.mjs --app rateradar --frames 01-hero     # one frame
//   node build.mjs --app rateradar --upload --version 1.2.2   # also upload to ASC (replaces 6.9" set)
//
// Auth for upload is the system `asc` CLI (keychain). No JWT/secrets handling here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const val = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : dflt;
};

const APP = val("app", "rateradar");
const FRAMES = val("frames", null);
const LOCALE = val("locale", "en-US");
const DEVICE_TYPE = val("device-type", "IPHONE_67"); // 1290x2796 → APP_IPHONE_67
const DO_CAPTURE = has("capture");
const DO_UPLOAD = has("upload");
const UPLOAD_VERSION = val("version", null);
const REPLACE = !has("no-replace");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"))[APP];
if (!config) throw new Error(`No config for app "${APP}"`);
const APP_ID = process.env.ASC_APP_ID || config.appId || "6768628917";

const run = (cmd, cmdArgs, opts = {}) => {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  return execFileSync(cmd, cmdArgs, { stdio: "inherit", cwd: __dirname, ...opts });
};

// ── Stage A: capture ─────────────────────────────────────────────────────────
if (DO_CAPTURE) {
  console.log("══ Stage A: capture native screens ══");
  run("node", ["capture.mjs", "--app", APP]);
} else {
  console.log("══ Stage A: capture SKIPPED (using committed ./screens) ══");
}

// ── Stage B: composite ───────────────────────────────────────────────────────
console.log("\n══ Stage B: composite posters ══");
const compArgs = ["compositor.mjs", "--app", APP];
if (FRAMES) compArgs.push("--frames", FRAMES);
run("node", compArgs);

// ── Stage C: stage for ASC fan-out ───────────────────────────────────────────
console.log("\n══ Stage C: stage for ASC ══");
const ascDir = path.join(OUT, "asc", LOCALE);
fs.rmSync(path.join(OUT, "asc"), { recursive: true, force: true });
fs.mkdirSync(ascDir, { recursive: true });
const frames = fs.readdirSync(OUT).filter((f) => /^\d\d-.*\.png$/.test(f)).sort();
for (const f of frames) fs.copyFileSync(path.join(OUT, f), path.join(ascDir, f));
console.log(`  staged ${frames.length} frame(s) → out/asc/${LOCALE}/`);

// ── Stage D: validate ────────────────────────────────────────────────────────
console.log("\n══ Stage D: validate (asc preflight) ══");
let validateOk = true;
try {
  run("asc", ["screenshots", "validate", "--path", ascDir, "--device-type", DEVICE_TYPE, "--output", "table"]);
} catch {
  validateOk = false;
  console.error("  ⚠ asc validate failed (is the `asc` CLI installed/authenticated?)");
}

// ── Stage E: upload ──────────────────────────────────────────────────────────
if (DO_UPLOAD) {
  console.log("\n══ Stage E: upload to App Store Connect ══");
  if (!validateOk) {
    console.error("  ✗ skipping upload — validation did not pass.");
    process.exit(1);
  }
  if (!UPLOAD_VERSION) {
    console.error("  ✗ --upload requires --version <x.y.z> (an EDITABLE App Store version).");
    process.exit(1);
  }
  const upArgs = [
    "screenshots", "upload",
    "--app", APP_ID,
    "--version", UPLOAD_VERSION,
    "--device-type", DEVICE_TYPE,
    "--path", path.join(OUT, "asc"),
  ];
  if (REPLACE) upArgs.push("--replace");
  run("asc", upArgs);
  console.log(`\n✓ Uploaded ${frames.length} screenshots to ${APP_ID} v${UPLOAD_VERSION} (${DEVICE_TYPE}).`);
} else {
  console.log("\n══ Stage E: upload SKIPPED (pass --upload --version <x.y.z>) ══");
}

console.log(`\n✅ Done. Posters in ${OUT}/  (staged for ASC in out/asc/${LOCALE}/)`);
