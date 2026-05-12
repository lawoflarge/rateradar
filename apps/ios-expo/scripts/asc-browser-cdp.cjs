// Keep-alive Chromium window exposed on CDP port 9222 so a separate
// driver process can connect via chromium.connectOverCDP().
//
// Persistent userDataDir at ../.asc-playwright-session/ keeps Levin's
// signed-in ASC session. Apple's trusted-browser cookie typically
// persists 30+ days so re-launching with the same dir avoids re-2FA.
//
// Usage: node scripts/asc-browser-cdp.cjs  (runs forever; Ctrl-C to stop)

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("C:\\Users\\levin\\node_modules\\playwright");

const USER_DATA = path.resolve(__dirname, "..", ".asc-playwright-session");
const CDP_PORT = 9222;

if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });

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

(async () => {
  console.log(`Launching Chromium (CDP=${CDP_PORT}) userDataDir=${USER_DATA}`);
  const context = await chromium.launchPersistentContext(USER_DATA, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: [`--remote-debugging-port=${CDP_PORT}`, "--start-maximized"],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(
    `https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/ios/version/inflight`,
    { waitUntil: "load", timeout: 60_000 },
  );
  console.log(`Ready. CDP at http://localhost:${CDP_PORT}. Browser stays open.`);
  // Keep alive
  await new Promise(() => {});
})();
