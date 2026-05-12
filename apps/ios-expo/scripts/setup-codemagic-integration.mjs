// Automates the Codemagic App Store Connect integration setup via Playwright.
// Opens a persistent headed Chromium where you log in once; everything else
// is filled and submitted by the script.
//
// Usage:
//   node scripts/setup-codemagic-integration.mjs
//
// What it does:
//   1. Launch headed Chromium with a persistent profile (.cache/codemagic-profile)
//   2. Navigate to codemagic.io
//   3. Wait for you to log in (detects URL change away from /signup or /signin)
//   4. Navigate to the team-level integrations page
//   5. Open the "App Store Connect" integration form
//   6. Fill name = "rateradar-asc", issuer ID, key ID
//   7. Upload the .p8 key file
//   8. Pause for you to click Save (we don't auto-submit destructive forms)
//
// Re-runnable: persistent profile keeps the login across invocations.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IOS_ROOT = path.resolve(__dirname, "..");

const KEY_FILE = path.join(IOS_ROOT, ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const PROFILE_DIR = path.join(IOS_ROOT, ".cache", "codemagic-profile");

const INTEGRATION_NAME = "rateradar-asc";
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

if (!fs.existsSync(KEY_FILE)) {
  console.error(`ERROR: .p8 key not found at ${KEY_FILE}`);
  process.exit(1);
}

fs.mkdirSync(PROFILE_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ["--start-maximized"],
});

const [page] = ctx.pages().length ? ctx.pages() : [await ctx.newPage()];

console.log("Opening codemagic.io...");
await page.goto("https://codemagic.io/apps", { waitUntil: "domcontentloaded" });

// Wait until we land on a logged-in page (not /signin or /signup)
console.log("");
console.log("=============================================================");
console.log("  If you see a login screen, sign in via GitHub now.");
console.log("  Once signed in, this script will continue automatically.");
console.log("=============================================================");
console.log("");

await page.waitForURL((url) => {
  const u = url.toString();
  return !u.includes("/signin") && !u.includes("/signup") && !u.includes("/login");
}, { timeout: 300_000 });

console.log("Logged in. Navigating to team settings...");

// Try the most common paths to the integrations page
const candidates = [
  "https://codemagic.io/settings/integrations",
  "https://codemagic.io/teams",
];

let landed = false;
for (const url of candidates) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const body = await page.textContent("body").catch(() => "");
  if (body && /integration/i.test(body)) {
    landed = true;
    console.log(`Landed at ${url}`);
    break;
  }
}

if (!landed) {
  console.log("");
  console.log("Could not auto-find the integrations page. Manually navigate to");
  console.log("the team Integrations page (top-right avatar -> team settings ->");
  console.log("Integrations) and then press ENTER here.");
  await new Promise((res) => {
    process.stdin.once("data", () => res());
  });
}

// Look for App Store Connect on the current page
console.log("Looking for App Store Connect option...");
const ascButton = page
  .locator("text=/App Store Connect/i")
  .first();

if ((await ascButton.count()) === 0) {
  console.log("");
  console.log("Couldn't auto-find 'App Store Connect' on this page.");
  console.log("Manually click it, then press ENTER.");
  await new Promise((res) => {
    process.stdin.once("data", () => res());
  });
} else {
  await ascButton.click();
  await page.waitForTimeout(1000);
}

// Look for a "Connect" or "Add" button to open the form
const connectButton = page
  .locator("button:has-text('Connect'), button:has-text('Add'), button:has-text('Configure')")
  .first();
if (await connectButton.count()) {
  await connectButton.click();
  await page.waitForTimeout(1500);
}

console.log("Filling integration form fields...");

// Try common label patterns for each field
async function fill(labels, value) {
  for (const label of labels) {
    const byLabel = page.getByLabel(label, { exact: false });
    if (await byLabel.count()) {
      await byLabel.first().fill(value);
      return true;
    }
  }
  return false;
}

await fill(["Name", "Integration name", "Integration"], INTEGRATION_NAME);
await fill(["Issuer ID", "Issuer"], ISSUER_ID);
await fill(["Key ID", "Identifier"], KEY_ID);

// Upload the .p8 file
const fileInput = page.locator("input[type='file']").first();
if (await fileInput.count()) {
  console.log(`Uploading ${KEY_FILE}...`);
  await fileInput.setInputFiles(KEY_FILE);
  await page.waitForTimeout(800);
}

console.log("");
console.log("=============================================================");
console.log("  Form is filled. Review and click Save in the Codemagic UI.");
console.log("  When you're done, press ENTER here to close the browser.");
console.log("=============================================================");
console.log("");

await new Promise((res) => {
  process.stdin.once("data", () => res());
});

await ctx.close();
console.log("Done.");
