// RateRadar App Store "Glow-Up" — Stage A: native screen capture.
//
// Builds the real SwiftUI app for an iPhone 16 Pro Max simulator, launches it
// with RATERADAR_SCREENSHOTS=1 (hides the AdMob banner — see Config.swift /
// AdsManager.swift), dismisses onboarding, then drives the UI with AXe to grab
// six clean, device-less app screens at native 1320x2868 into ./screens.
//
// These captures are committed, so build.mjs SKIPS this stage by default and
// just recomposites. Run this only to refresh the source screens:
//   node capture.mjs --app rateradar
//
// Robust steps use AXe label taps (deterministic). A couple of screens need a
// scroll offset into a long editorial dashboard — those swipe counts are tuned
// for this device and may need a nudge if the app layout shifts; verify the
// output PNGs visually after a refresh.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IOS_DIR = path.resolve(__dirname, "..", "..", "ios");
const SCREENS = path.join(__dirname, "screens");

const BUNDLE = "com.lawoflarge.rateradar";
const SIM_NAME = "RR-Shots-69";
const SIM_DEVICE = "iPhone 16 Pro Max";
const DD = "/tmp/rr_dd";

const sh = (cmd, a, opts = {}) =>
  execFileSync(cmd, a, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });
const sleep = (s) => { try { execFileSync("sleep", [String(s)]); } catch {} };
const log = (m) => console.log(m);

// ── simulator helpers ────────────────────────────────────────────────────────
function ensureSim() {
  const list = sh("xcrun", ["simctl", "list", "devices"]);
  let udid = new RegExp(`${SIM_NAME} \\(([0-9A-F-]+)\\)`).exec(list)?.[1];
  if (!udid) {
    const rt = /com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+/.exec(
      sh("xcrun", ["simctl", "list", "runtimes"]),
    )?.[0];
    udid = sh("xcrun", ["simctl", "create", SIM_NAME, SIM_DEVICE, rt]).trim();
    log(`  created sim ${udid}`);
  }
  try { sh("xcrun", ["simctl", "boot", udid]); } catch {}
  return udid;
}

function buildAndInstall(udid) {
  log("  xcodegen + xcodebuild (simulator)…");
  sh("xcodegen", ["generate"], { cwd: IOS_DIR });
  execFileSync("xcodebuild", [
    "-project", "RateRadar.xcodeproj", "-scheme", "RateRadar",
    "-configuration", "Debug", "-sdk", "iphonesimulator",
    "-destination", `id=${udid}`, "-derivedDataPath", DD, "-quiet", "build",
  ], { cwd: IOS_DIR, stdio: "inherit" });
  const app = `${DD}/Build/Products/Debug-iphonesimulator/RateRadar.app`;
  try { sh("xcrun", ["simctl", "uninstall", udid, BUNDLE]); } catch {}
  sh("xcrun", ["simctl", "install", udid, app]);
  sh("xcrun", ["simctl", "status_bar", udid, "override", "--time", "9:41",
    "--dataNetwork", "wifi", "--wifiBars", "3", "--cellularMode", "active",
    "--cellularBars", "4", "--batteryState", "discharging", "--batteryLevel", "100"]);
}

const axe = (a, udid) => { try { return sh("axe", [...a, "--udid", udid]); } catch { return ""; } };
const tap = (label, udid, post = 1.4) => axe(["tap", "--label", label, "--post-delay", String(post)], udid);
const tapType = (label, type, udid, post = 1.4) =>
  axe(["tap", "--label", label, "--element-type", type, "--post-delay", String(post)], udid);
const swipe = (sy, ey, udid) =>
  axe(["swipe", "--start-x", "220", "--start-y", String(sy), "--end-x", "220", "--end-y", String(ey), "--duration", "0.4"], udid);
const shot = (id, udid) => {
  sh("xcrun", ["simctl", "io", udid, "screenshot", "--type", "png", path.join(SCREENS, `${id}.png`)]);
  log(`  ✓ ${id}.png`);
};
const home = (udid) => tap("RateRadar, RateRadar", udid, 1.2);

// ── capture plan ─────────────────────────────────────────────────────────────
function captureAll(udid) {
  // launch with the screenshot flag (hides ad banner)
  try { sh("xcrun", ["simctl", "terminate", udid, BUNDLE]); } catch {}
  execFileSync("xcrun", ["simctl", "launch", udid, BUNDLE], {
    env: { ...process.env, SIMCTL_CHILD_RATERADAR_SCREENSHOTS: "1" },
  });
  sleep(3);
  tap("Not now", udid, 1.5); // dismiss onboarding (no-op if absent)
  sleep(1);

  // 01 hero — dashboard top
  shot("01-hero", udid);

  // 05 coverage — Fed vs ECB divergence tracker (robust nav)
  tap("Fed vs ECB", udid); shot("05-coverage", udid); home(udid);

  // 04 alerts — Alerts settings (robust nav)
  tapType("Alerts", "Button", udid); shot("04-alerts", udid); home(udid);

  // 02 odds — Fed hub → Dec 9 meeting detail (Hold 64% gauge)
  tapType("Fed", "Button", udid);
  swipe(820, 230, udid); swipe(820, 230, udid); // into the upcoming-meetings list
  tap("Wednesday, December 9, 2026, Hold · 64%", udid);
  shot("02-odds", udid);
  home(udid);

  // 03 chart — dashboard scrolled to a per-meeting probability + 60-day history chart
  swipe(760, 300, udid); // most-likely path
  swipe(800, 220, udid);
  swipe(300, 720, udid); // settle on the Jun 17 inline section (table + history chart)
  shot("03-chart", udid);
  home(udid);

  // 06 cta — most-likely forward-path cards (distinct from the hero screen)
  home(udid);
  swipe(760, 320, udid); // reveal "Most likely path · cumulative" FED PATH chain
  shot("06-cta", udid);
}

// ── main ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(SCREENS, { recursive: true });
const udid = ensureSim();
buildAndInstall(udid);
log("  capturing…");
captureAll(udid);
log(`\n✅ Captured native screens → ${SCREENS}`);
console.log("   Verify the PNGs visually — scroll-positioned frames (02,03) can drift if the app layout changes.");
