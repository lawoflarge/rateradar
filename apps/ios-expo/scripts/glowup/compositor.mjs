// RateRadar App Store "Glow-Up" compositor.
//
// Stage B. Composites the REAL native app UI — embedded in a real iPhone 16 Pro
// Max titanium frame (Koubou, via frame-device.py) — into a premium dark-navy
// App Store poster at EXACTLY 1290x2796 (ASC 6.9" `_67`), using Playwright/
// Chromium as an HTML renderer. Fully offline: the framed device, fonts and the
// real app icon are base64-embedded, no network at render time.
//
// Brand-consistent with the app: amber (#C8841C/E6A84B) accent + the real radar
// mark (rings + amber needle) + the actual app icon. Numbers stay 1:1 crops of
// the live UI (no faked data).
//
// Usage: node compositor.mjs [--app rateradar] [--frames 01-hero,...] [--dpr 2]
// Output: ./out/<id>.png  (exactly 1290x2796)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  "/Users/levinschwab/Data/Claude/browser-automation/node_modules/playwright/index.mjs";
const { chromium } = await import(PLAYWRIGHT_PATH);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENS = path.join(__dirname, "screens");
const FONTS = path.join(__dirname, "fonts");
const OUT = path.join(__dirname, "out");
const FRAMED = path.join(OUT, ".framed");
const ICON = path.resolve(__dirname, "..", "..", "..", "ios", "RateRadar", "Resources", "Assets.xcassets", "AppIcon.appiconset", "icon.png");

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const APP = argVal("app", "rateradar");
const DPR = Number(argVal("dpr", "2"));
const frameFilter = argVal("frames", null);
const IPAD = args.includes("--ipad");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"))[APP];
if (!config) throw new Error(`No config for app "${APP}"`);
const P = config.palette;
const W = IPAD ? 2064 : config.size.w;   // iPad Pro 12.9" 2064x2752 (APP_IPAD_PRO_3GEN_129)
const H = IPAD ? 2752 : config.size.h;   // iPhone 6.9" 1290x2796 (APP_IPHONE_67)
const ACCENT = P.amber;        // brand accent (amber) — matches the app icon needle
const ACCENT_DEEP = "#C8841C"; // exact app "cut" amber for the radar needle

const b64 = (p) => fs.readFileSync(p).toString("base64");
const FONT_GROTESK = b64(path.join(FONTS, "SpaceGrotesk.ttf"));
const FONT_MONO = b64(path.join(FONTS, "JetBrainsMono.ttf"));
const ICON_URI = `data:image/png;base64,${b64(ICON)}`;
const screenUri = (file) => `data:image/png;base64,${b64(path.join(SCREENS, file))}`;

const SCREEN_W = 1320, SCREEN_H = 2868;

// ── framed device generation (real iPhone titanium frame) ────────────────────
function ensureFramed(screenFile) {
  fs.mkdirSync(FRAMED, { recursive: true });
  const out = path.join(FRAMED, screenFile);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(path.join(SCREENS, screenFile)).mtimeMs) {
    execFileSync("python3", [path.join(__dirname, "frame-device.py"), path.join(SCREENS, screenFile), out], { stdio: "ignore" });
  }
  return `data:image/png;base64,${b64(out)}`;
}

// ── brand: the real radar mark (rings + amber needle) ────────────────────────
function radarMark(size, ringColor = "#FFFFFF") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="21" stroke="${ringColor}" stroke-width="2.6"/>
    <circle cx="24" cy="24" r="13.5" stroke="${ringColor}" stroke-width="1.4" opacity="0.85"/>
    <circle cx="24" cy="24" r="6.2" stroke="${ringColor}" stroke-width="1.4" opacity="0.7"/>
    <line x1="24" y1="24" x2="38" y2="15" stroke="${ACCENT_DEEP}" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="38.5" cy="14.6" r="2.6" fill="${ACCENT_DEEP}"/>
  </svg>`;
}

function headlineHTML(text, accent) {
  if (accent && text.includes(accent)) {
    const [a, b] = text.split(accent);
    return `${a}<span class="accent">${accent}</span>${b}`;
  }
  return text;
}

function deviceImg(screenFile, klass) {
  return `<img class="device-img ${klass}" src="${ensureFramed(screenFile)}" alt=""/>`;
}

function calloutCard(screenFile, cropFrac, cardW, caption) {
  const [fx, fy, fw, fh] = cropFrac;
  const scale = cardW / (fw * SCREEN_W);
  const imgW = SCREEN_W * scale, imgH = SCREEN_H * scale;
  const tx = -fx * SCREEN_W * scale, ty = -fy * SCREEN_H * scale;
  const clipH = Math.round(fh * SCREEN_H * scale);
  return `<div class="callout-card" style="width:${cardW}px;">
    <div class="callout-clip" style="height:${clipH}px;">
      <img src="${screenUri(screenFile)}" style="width:${imgW}px; height:${imgH}px; transform:translate(${tx}px, ${ty}px);"/>
    </div>
    ${caption ? `<div class="callout-cap"><span class="dot"></span>${caption}</div>` : ""}
  </div>`;
}

function header(f) {
  return `<header class="head">
    <div class="eyebrow">${f.eyebrow}</div>
    <h1 class="headline">${headlineHTML(f.headline, f.accent)}</h1>
    <p class="subline">${f.subline}</p>
  </header>`;
}
function footer() {
  return `<footer class="foot">
    <img class="foot-icon" src="${ICON_URI}"/>
    <span class="wordmark">${config.wordmark}</span>
  </footer>`;
}

const LAYOUTS = {
  hero(f) {
    return `${header(f)}${deviceImg(f.screen, "dev-hero")}${footer()}`;
  },
  callout(f) {
    const card = f.callout
      ? `<div class="callout-wrap"><div class="leader"></div>${calloutCard(f.screen, f.callout.cropFrac, 640, f.callout.caption)}</div>`
      : "";
    return `${header(f)}${deviceImg(f.screen, "dev-callout")}${card}${footer()}`;
  },
  chart(f) {
    return `${header(f)}${deviceImg(f.screen, "dev-hero")}${footer()}`;
  },
  alerts(f) {
    const banner = f.banner
      ? `<div class="push-banner">
           <span class="push-icon"><img src="${ICON_URI}"/></span>
           <div class="push-text">
             <div class="push-row"><span class="push-app">${f.banner.title}</span><span class="push-time">now</span></div>
             <div class="push-body">${f.banner.body}</div>
           </div>
         </div>`
      : "";
    return `${header(f)}<div class="dev-host">${deviceImg(f.screen, "dev-hero")}${banner}</div>${footer()}`;
  },
  coverage(f) {
    const chips = (f.chips || [])
      .map((c, i) => `<div class="flag-chip chip-${i}"><span class="chip-dot"></span>${c}</div>`)
      .join("");
    return `${header(f)}<div class="dev-host">${deviceImg(f.screen, "dev-hero")}<div class="chips">${chips}</div></div>${footer()}`;
  },
  cta(f) {
    return `${header(f)}${f.cta ? `<div class="cta-btn">${f.cta}</div>` : ""}${deviceImg(f.screen, "dev-cta")}${footer()}`;
  },
};

function radarBg() {
  const cx = Math.round(W / 2), cy = Math.round(H * 0.5);
  const rings = [240, 470, 700, 940, 1180]
    .map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="2"/>`)
    .join("");
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const x1 = cx + Math.cos(a) * 1120, y1 = cy + Math.sin(a) * 1120;
    const x2 = cx + Math.cos(a) * 1180, y2 = cy + Math.sin(a) * 1180;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(230,168,75,0.10)" stroke-width="2"/>`;
  }).join("");
  const needle = `<line x1="${cx}" y1="${cy}" x2="${cx + 1180 * Math.cos(-0.55)}" y2="${cy + 1180 * Math.sin(-0.55)}" stroke="rgba(230,168,75,0.22)" stroke-width="3"/>`;
  return `<svg class="radar" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rings}${ticks}${needle}</svg>`;
}

function css() {
  return `
  @font-face { font-family:'Grotesk'; src:url(data:font/ttf;base64,${FONT_GROTESK}) format('truetype'); font-weight:300 800; }
  @font-face { font-family:'Mono'; src:url(data:font/ttf;base64,${FONT_MONO}) format('truetype'); font-weight:300 800; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; }
  body { position:relative; overflow:hidden; background:${P.navy}; font-family:'Grotesk',sans-serif; -webkit-font-smoothing:antialiased; }

  .bg { position:absolute; inset:0; background:
      radial-gradient(120% 70% at 50% 64%, rgba(230,168,75,0.10), rgba(230,168,75,0) 50%),
      radial-gradient(130% 80% at 50% 12%, rgba(120,150,190,0.06), rgba(0,0,0,0) 46%),
      linear-gradient(180deg, #0D1322 0%, ${P.navy} 44%, #06080F 100%); }
  .radar { position:absolute; left:0; top:0; opacity:0.9; }
  .sweep { position:absolute; left:50%; top:50%; width:2400px; height:2400px; transform:translate(-50%,-50%); border-radius:50%;
      background:conic-gradient(from -40deg, rgba(230,168,75,0.14), rgba(230,168,75,0.02) 26%, rgba(0,0,0,0) 42%);
      -webkit-mask:radial-gradient(circle, #000 0%, #000 56%, transparent 70%); }
  .vignette { position:absolute; inset:0; box-shadow: inset 0 0 480px 100px rgba(0,0,0,0.62); pointer-events:none; }
  .stage { position:absolute; inset:0; z-index:2; }

  .head { position:absolute; top:118px; left:92px; right:92px; z-index:5; }
  .eyebrow { font-family:'Mono'; font-weight:700; font-size:34px; letter-spacing:0.12em; color:${ACCENT}; text-transform:uppercase; margin-bottom:22px; }
  .headline { font-family:'Grotesk'; font-weight:700; font-size:90px; line-height:1.03; letter-spacing:-0.024em; color:#FFFFFF; text-wrap:balance; max-width:1040px; }
  .headline .accent { color:${ACCENT}; }
  .subline { margin-top:24px; font-family:'Grotesk'; font-weight:500; font-size:35px; line-height:1.3; color:${P.slate}; max-width:920px; }

  .device-img { position:absolute; left:50%; transform:translateX(-50%); z-index:3;
      filter: drop-shadow(0 56px 70px rgba(0,0,0,0.62)) drop-shadow(0 0 70px rgba(230,168,75,0.14)); }
  .dev-hero { width:980px; top:560px; }
  .dev-callout { width:900px; top:560px; }
  .dev-cta { width:900px; top:640px; }
  .dev-host { position:absolute; inset:0; z-index:3; }

  .callout-wrap { position:absolute; right:46px; top:1760px; z-index:8; }
  .callout-card { position:relative; border-radius:30px; overflow:hidden; background:#F5F1E8;
      box-shadow: 0 40px 80px -18px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(230,168,75,0.6), 0 0 56px 0 rgba(230,168,75,0.22); }
  .callout-clip { position:relative; overflow:hidden; width:100%; }
  .callout-clip img { position:absolute; left:0; top:0; max-width:none; }
  .callout-cap { display:flex; align-items:center; gap:12px; padding:16px 24px 18px; font-family:'Mono'; font-weight:700;
      font-size:24px; letter-spacing:0.12em; text-transform:uppercase; color:#6F6A60; background:#EFEADD; border-top:1px solid #C9C2B0; }
  .callout-cap .dot { width:13px; height:13px; border-radius:50%; background:${ACCENT_DEEP}; }
  .leader { position:absolute; left:-118px; top:78px; width:140px; height:2px; background:linear-gradient(90deg, rgba(230,168,75,0), ${ACCENT}); z-index:7; box-shadow:0 0 8px rgba(230,168,75,0.5); }
  .leader::before { content:''; position:absolute; left:-7px; top:-4px; width:10px; height:10px; border-radius:50%; background:${ACCENT}; box-shadow:0 0 10px ${ACCENT}; }

  .push-banner { position:absolute; z-index:9; left:50%; top:470px; transform:translateX(-50%); width:780px;
      display:flex; align-items:center; gap:22px; padding:24px 28px; border-radius:34px;
      background:rgba(250,250,252,0.94); box-shadow:0 36px 80px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.5); }
  .push-icon img { width:66px; height:66px; border-radius:16px; display:block; }
  .push-text { flex:1; min-width:0; }
  .push-row { display:flex; justify-content:space-between; align-items:baseline; }
  .push-app { font-weight:700; font-size:29px; color:#0B0F1A; }
  .push-time { font-size:23px; color:#8A93A3; }
  .push-body { margin-top:5px; font-weight:500; font-size:29px; color:#1C2430; line-height:1.25; }

  .chips { position:absolute; z-index:8; top:420px; left:50%; transform:translateX(-50%); display:flex; gap:26px; }
  .flag-chip { display:inline-flex; align-items:center; gap:14px; padding:18px 36px; border-radius:999px;
      font-family:'Mono'; font-weight:700; font-size:36px; letter-spacing:0.1em; color:#FFFFFF;
      background:rgba(13,18,30,0.82); border:1px solid rgba(255,255,255,0.16); box-shadow:0 18px 40px -12px rgba(0,0,0,0.6); }
  .chip-dot { width:18px; height:18px; border-radius:50%; }
  .chip-0 .chip-dot { background:${ACCENT}; }
  .chip-1 .chip-dot { background:#9AA7B8; }

  .cta-btn { position:absolute; top:560px; left:92px; z-index:6; padding:26px 52px; border-radius:999px;
      background:${ACCENT}; color:#241400; font-weight:700; font-size:34px;
      box-shadow:0 24px 56px -16px rgba(230,168,75,0.55), 0 0 0 1px rgba(255,255,255,0.18); white-space:nowrap; }

  .foot { position:absolute; left:92px; bottom:70px; z-index:10; display:flex; align-items:center; gap:18px; }
  .foot-icon { width:58px; height:58px; border-radius:14px; box-shadow:0 6px 18px rgba(0,0,0,0.4); }
  .wordmark { font-family:'Grotesk'; font-weight:700; font-size:40px; letter-spacing:-0.01em; color:#FFFFFF; }
  `;
}

// iPad Pro layout: text left, framed device right (uses the wide canvas).
function ipadFrameHTML(f) {
  const ipadCss = `
  .ipad-head { position:absolute; left:140px; top:0; bottom:0; width:1010px; display:flex; flex-direction:column; justify-content:center; z-index:5; }
  .ipad-head .ey { font-family:'Mono'; font-weight:700; font-size:42px; letter-spacing:0.12em; color:${ACCENT}; text-transform:uppercase; margin-bottom:34px; }
  .ipad-head .hl { font-family:'Grotesk'; font-weight:700; font-size:132px; line-height:1.02; letter-spacing:-0.024em; color:#fff; text-wrap:balance; }
  .ipad-head .hl .accent { color:${ACCENT}; }
  .ipad-head .sub { margin-top:38px; font-family:'Grotesk'; font-weight:500; font-size:50px; line-height:1.3; color:${P.slate}; max-width:880px; }
  .ipad-dev { position:absolute; right:-150px; top:50%; transform:translateY(-50%); width:1120px; z-index:3;
      filter: drop-shadow(0 64px 84px rgba(0,0,0,0.62)) drop-shadow(0 0 84px rgba(230,168,75,0.14)); }
  .ipad-foot { position:absolute; left:140px; bottom:96px; z-index:10; display:flex; align-items:center; gap:24px; }
  .ipad-foot img { width:78px; height:78px; border-radius:18px; box-shadow:0 6px 18px rgba(0,0,0,0.4); }
  .ipad-foot .wm { font-family:'Grotesk'; font-weight:700; font-size:54px; color:#fff; }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css()}${ipadCss}</style></head>
  <body>
    <div class="bg"></div>${radarBg()}<div class="sweep"></div><div class="vignette"></div>
    <div class="ipad-head"><div class="ey">${f.eyebrow}</div><h1 class="hl">${headlineHTML(f.headline, f.accent)}</h1><p class="sub">${f.subline}</p></div>
    <img class="ipad-dev" src="${ensureFramed(f.screen)}"/>
    <div class="ipad-foot"><img src="${ICON_URI}"/><span class="wm">${config.wordmark}</span></div>
  </body></html>`;
}

function frameHTML(f) {
  const inner = (LAYOUTS[f.layout] || LAYOUTS.hero)(f);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css()}</style></head>
  <body>
    <div class="bg"></div>
    ${radarBg()}
    <div class="sweep"></div>
    <div class="vignette"></div>
    <div class="stage">${inner}</div>
  </body></html>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(OUT, ".tmp");
  fs.mkdirSync(tmp, { recursive: true });

  let frames = config.frames;
  if (frameFilter) {
    const want = frameFilter.split(",").map((s) => s.trim());
    frames = frames.filter((f) => want.includes(f.id));
  }

  const outDir = IPAD ? path.join(OUT, "ipad") : OUT;
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });

  for (const f of frames) {
    await page.setContent(IPAD ? ipadFrameHTML(f) : frameHTML(f), { waitUntil: "load" });
    await page.evaluate(async () => { await document.fonts.ready; });
    const raw = path.join(tmp, `${f.id}.png`);
    await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: W, height: H } });
    const final = path.join(outDir, `${f.id}.png`);
    execFileSync("sips", ["-z", String(H), String(W), raw, "--out", final], { stdio: "ignore" });
    const dim = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", final]).toString();
    console.log(`✓ ${f.id}  ${/pixelWidth: (\d+)/.exec(dim)[1]}x${/pixelHeight: (\d+)/.exec(dim)[1]}  (${f.layout})`);
  }

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRendered ${frames.length} frame(s) → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
