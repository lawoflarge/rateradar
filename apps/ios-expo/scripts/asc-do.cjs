// Driver CLI — connects to the CDP-exposed Chromium from
// asc-browser-cdp.cjs and runs one operation per invocation.
//
// Usage:
//   node scripts/asc-do.cjs url
//   node scripts/asc-do.cjs goto <url>
//   node scripts/asc-do.cjs snapshot               # short interactive snapshot
//   node scripts/asc-do.cjs snapshot-full          # full role tree
//   node scripts/asc-do.cjs click-text "<text>"    # click element by visible text
//   node scripts/asc-do.cjs click-role <role> "<name>"
//   node scripts/asc-do.cjs click-selector "<css>"
//   node scripts/asc-do.cjs fill-selector "<css>" "<value>"
//   node scripts/asc-do.cjs press <key>
//   node scripts/asc-do.cjs wait-text "<text>"
//   node scripts/asc-do.cjs wait-time <ms>
//   node scripts/asc-do.cjs screenshot <path>

const { chromium } = require("C:\\Users\\levin\\node_modules\\playwright");

const CDP_URL = "http://localhost:9222";

async function getPage() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  // Try to pick the first page that looks like ASC, else first page
  let page = ctx.pages().find((p) => p.url().includes("appstoreconnect.apple.com"));
  if (!page) page = ctx.pages()[0] || (await ctx.newPage());
  return { browser, page };
}

async function snapshot(page) {
  // Modern Playwright uses ARIA snapshot via locator. Older `page.accessibility`
  // namespace was removed/moved in 1.50+. ariaSnapshot returns a YAML-ish
  // string of the role tree, perfect for agent decision-making.
  return await page.locator("html").ariaSnapshot({ timeout: 10_000 });
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) { console.error("missing command"); process.exit(1); }

  const { browser, page } = await getPage();

  try {
    switch (cmd) {
      case "url":
        console.log(page.url());
        break;
      case "title":
        console.log(await page.title());
        break;
      case "goto": {
        await page.goto(rest[0], { waitUntil: "load", timeout: 60_000 });
        console.log("now at:", page.url());
        break;
      }
      case "snapshot": {
        const snap = await snapshot(page);
        // Truncate to a reasonable size for chat — first 5000 chars
        console.log(snap.length > 5000 ? snap.slice(0, 5000) + "\n[…truncated, " + snap.length + " chars total]" : snap);
        break;
      }
      case "snapshot-full": {
        const snap = await snapshot(page);
        console.log(snap);
        break;
      }
      case "snapshot-scope": {
        const sel = rest[0];
        const snap = await page.locator(sel).first().ariaSnapshot({ timeout: 10_000 });
        console.log(snap);
        break;
      }
      case "click-text": {
        await page.getByText(rest[0], { exact: false }).first().click({ timeout: 15_000 });
        console.log("clicked text:", rest[0]);
        break;
      }
      case "click-role": {
        await page.getByRole(rest[0], { name: rest[1] }).first().click({ timeout: 15_000 });
        console.log(`clicked role=${rest[0]} name=${rest[1]}`);
        break;
      }
      case "click-selector": {
        await page.locator(rest[0]).first().click({ timeout: 15_000 });
        console.log("clicked selector:", rest[0]);
        break;
      }
      case "fill-selector": {
        await page.locator(rest[0]).first().fill(rest[1], { timeout: 15_000 });
        console.log("filled:", rest[0]);
        break;
      }
      case "press": {
        await page.keyboard.press(rest[0]);
        console.log("pressed:", rest[0]);
        break;
      }
      case "force-click-text": {
        // Force-click via JS — bypasses Playwright's hit-test which sometimes
        // misses React-handler buttons in modal stacks.
        const text = rest[0];
        const ok = await page.evaluate((t) => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const btn = buttons.find((b) => b.textContent?.trim() === t || b.textContent?.trim().startsWith(t));
          if (!btn) return false;
          btn.click();
          return true;
        }, text);
        console.log(ok ? `JS-clicked button with text: ${text}` : `no button matched: ${text}`);
        break;
      }
      case "force-click-radio-starts": {
        // Click a radio whose visible label STARTS with the given text.
        // Works around Playwright's getByRole hit-test misses on ASC modals.
        const prefix = rest[0];
        const ok = await page.evaluate((p) => {
          const inputs = Array.from(document.querySelectorAll('input[type="radio"]'));
          for (const input of inputs) {
            const lbl = input.closest("label") || input.parentElement;
            const txt = (lbl?.textContent || "").trim();
            if (txt.startsWith(p)) { input.click(); return true; }
          }
          return false;
        }, prefix);
        console.log(ok ? `JS-clicked radio starts: ${prefix}` : `no radio matched: ${prefix}`);
        break;
      }
      case "force-click-checkbox-starts": {
        const prefix = rest[0];
        const ok = await page.evaluate((p) => {
          const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          for (const input of inputs) {
            const lbl = input.closest("label") || input.parentElement;
            const txt = (lbl?.textContent || "").trim();
            if (txt.startsWith(p)) { input.click(); return true; }
          }
          return false;
        }, prefix);
        console.log(ok ? `JS-clicked checkbox starts: ${prefix}` : `no checkbox matched: ${prefix}`);
        break;
      }
      case "click-in-dialog": {
        // Click a button (by text) that lives INSIDE a [role=dialog].
        // Avoids matching the same-named button on the underlying page.
        const text = rest[0];
        await page.locator('[role=dialog] button').filter({ hasText: text }).first().click({ timeout: 10_000 });
        console.log(`clicked [role=dialog] button: ${text}`);
        break;
      }
      case "list-buttons": {
        const list = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("button")).map((b, i) => ({
            i,
            text: (b.textContent || "").trim().slice(0, 60),
            disabled: b.disabled,
            visible: b.offsetParent !== null,
          }));
        });
        console.log(JSON.stringify(list.filter((b) => b.visible), null, 2));
        break;
      }
      case "wait-text": {
        await page.getByText(rest[0]).first().waitFor({ state: "visible", timeout: 30_000 });
        console.log("text visible:", rest[0]);
        break;
      }
      case "wait-time": {
        await page.waitForTimeout(parseInt(rest[0], 10));
        console.log("waited", rest[0], "ms");
        break;
      }
      case "screenshot": {
        await page.screenshot({ path: rest[0], fullPage: false });
        console.log("saved", rest[0]);
        break;
      }
      default:
        console.error("unknown command:", cmd);
        process.exit(1);
    }
  } finally {
    // Important: don't close the browser, just disconnect
    await browser.close();
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
