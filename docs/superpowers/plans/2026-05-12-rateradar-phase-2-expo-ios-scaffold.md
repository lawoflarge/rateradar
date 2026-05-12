# RateRadar Phase 2 — Expo iOS Scaffold + WebView Wrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Expo SDK 54 + react-native-webview iOS app at `apps/ios-expo/` that loads `https://rateradar-web.vercel.app` as its primary view, configures the bundle id and Apple Team and EAS project id, and ships the privacy manifest + minimum capabilities required to build cleanly. No native modules yet — those are Phase 3.

**Architecture:** Mirror the Titi & Bina Expo template at `C:\Users\levin\bibi-tina-game\ios-expo` with adaptations: portrait orientation, light userInterfaceStyle, no Game Center, single WebView pointed at the live rateradar-web URL, AppState pause-on-background (using `injectJavaScript('window.dispatchEvent(new Event("rr-pause"))')` so the web app can hook it). The web app's existing `force-dynamic` API routes and ISR continue to serve both browsers and the iOS WebView.

**Tech Stack:** Expo SDK 54, React 19.1.0, React Native 0.81.5, `react-native-webview` 13.15.0, `expo-status-bar`, `expo-splash-screen`, `expo-keep-awake` (optional), TypeScript 5.9.

**Branch:** `ios-launch-v1` (re-checkout after merge to main).

**Spec:** `docs/superpowers/specs/2026-05-12-rateradar-ios-app-store-launch-design.md` §5.2

---

## File Structure

### Files created
```
apps/ios-expo/
  App.tsx
  app.json
  eas.json
  babel.config.js
  metro.config.js
  tsconfig.json
  package.json
  package-lock.json
  PrivacyInfo.xcprivacy
  .gitignore
  README.md
  assets/
    icon.png            (1024×1024 placeholder — real icon in Phase 5)
    adaptive-icon.png
    splash.png
  plugins/
    withPrivacyManifest.js
  src/
    WebViewHost.tsx     (extracted WebView component for testability)
    hooks/
      useAppStatePause.ts
    lib/
      constants.ts      (WEB_BASE_URL, etc.)
  __tests__/
    WebViewHost.test.tsx
    useAppStatePause.test.ts
```

### Files modified (root)
- `apps/ios-expo/` is added to `pnpm-workspace.yaml` if applicable (skip if it would pull pnpm/turbo into the iOS app — Expo apps are happier as their own root, so this is likely NOT needed)
- Root `.gitignore` extended for `apps/ios-expo/node_modules/`, `*.ipa`, `.expo/`, `dist/`

### Files unchanged
- Everything in `apps/web/`
- Everything in `apps/ios/RateRadar/` (the legacy Swift scaffold — left untouched, will be removed in Phase 6 if we decide)

---

## Task 1 — Create directory + package.json

**Files:**
- Create: `apps/ios-expo/package.json`
- Create: `apps/ios-expo/.gitignore`

- [ ] **Step 1: Create directory**

```powershell
mkdir "C:\Users\levin\rateradar\apps\ios-expo"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\assets"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\plugins"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\src"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\src\hooks"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\src\lib"
mkdir "C:\Users\levin\rateradar\apps\ios-expo\__tests__"
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "rateradar-ios",
  "version": "1.0.0",
  "private": true,
  "description": "iOS shell for RateRadar — Expo + react-native-webview wrapping rateradar-web.vercel.app",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "build:preview": "eas build --platform ios --profile preview",
    "build:production": "eas build --platform ios --profile production",
    "submit": "eas submit --platform ios",
    "test": "jest --passWithNoTests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~54.0.0",
    "expo-asset": "~12.0.13",
    "expo-keep-awake": "~15.0.8",
    "expo-splash-screen": "~31.0.13",
    "expo-status-bar": "~3.0.9",
    "expo-updates": "~29.0.17",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-native-safe-area-context": "5.4.0",
    "react-native-webview": "13.15.0"
  },
  "devDependencies": {
    "@testing-library/react-native": "^13.0.0",
    "@types/jest": "^29.5.0",
    "@types/react": "~19.1.0",
    "babel-preset-expo": "~54.0.10",
    "jest": "^29.7.0",
    "jest-expo": "~54.0.0",
    "react-test-renderer": "19.1.0",
    "typescript": "~5.9.0"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
.expo/
dist/
ios/
android/
*.ipa
*.apk
.env*.local
*.tsbuildinfo
.secrets/
.eas/
__snapshots__/
```

- [ ] **Step 4: Install deps**

```powershell
cd C:\Users\levin\rateradar\apps\ios-expo
pnpm install
```

If pnpm complains about workspace conflicts, use `npm install` instead (Expo apps work fine with npm; this avoids the monorepo entanglement).

- [ ] **Step 5: Commit**

```
feat(ios): bootstrap Expo SDK 54 + RN 0.81 package.json for ios-expo
```

---

## Task 2 — TypeScript + Babel + Metro config

**Files:**
- Create: `apps/ios-expo/tsconfig.json`
- Create: `apps/ios-expo/babel.config.js`
- Create: `apps/ios-expo/metro.config.js`

- [ ] **Step 1: Write tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["jest", "node"],
    "jsx": "react-native"
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

- [ ] **Step 2: Write babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
```

- [ ] **Step 3: Write metro.config.js**

```js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
```

- [ ] **Step 4: Commit**

```
chore(ios): tsconfig + babel + metro
```

---

## Task 3 — App configuration (app.json, eas.json, PrivacyInfo)

**Files:**
- Create: `apps/ios-expo/app.json`
- Create: `apps/ios-expo/eas.json`
- Create: `apps/ios-expo/PrivacyInfo.xcprivacy`
- Create: `apps/ios-expo/plugins/withPrivacyManifest.js`

- [ ] **Step 1: Write app.json**

```json
{
  "expo": {
    "name": "RateRadar",
    "slug": "rateradar-ios",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F5F1E8"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.lawoflarge.rateradar",
      "buildNumber": "1",
      "requireFullScreen": false,
      "infoPlist": {
        "CFBundleDisplayName": "RateRadar",
        "ITSAppUsesNonExemptEncryption": false,
        "NSPrivacyTracking": false,
        "NSPrivacyTrackingDomains": [],
        "UIStatusBarStyle": "UIStatusBarStyleDefault"
      }
    },
    "plugins": [
      "expo-splash-screen",
      "expo-asset",
      "./plugins/withPrivacyManifest"
    ],
    "assetBundlePatterns": ["**/*"],
    "extra": {
      "eas": {
        "projectId": "PLACEHOLDER_REPLACE_AFTER_EAS_INIT"
      }
    },
    "runtimeVersion": { "policy": "appVersion" }
  }
}
```

Note: the `eas.projectId` placeholder is filled by `eas init` later (or set manually after creating the EAS project). For now, leave as placeholder — `eas init` will update it on first build attempt.

- [ ] **Step 2: Write eas.json**

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "levin.schwab@gmx.de",
        "ascAppId": "PLACEHOLDER_REPLACE_AFTER_ASC_APP_CREATE",
        "appleTeamId": "R95M36AU2X"
      }
    }
  }
}
```

- [ ] **Step 3: Write PrivacyInfo.xcprivacy**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
      <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
          <string>CA92.1</string>
        </array>
      </dict>
    </array>
  </dict>
</plist>
```

- [ ] **Step 4: Write plugins/withPrivacyManifest.js**

```js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withPrivacyManifest = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const src = path.join(projectRoot, "PrivacyInfo.xcprivacy");
      const dest = path.join(platformRoot, "PrivacyInfo.xcprivacy");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
      return cfg;
    },
  ]);
};

module.exports = withPrivacyManifest;
```

- [ ] **Step 5: Commit**

```
feat(ios): app.json + eas.json + PrivacyInfo + manifest config plugin
```

---

## Task 4 — Asset placeholders

**Files:**
- Create: `apps/ios-expo/assets/icon.png` (1024×1024, Wire Room cream + ink BrandMark)
- Create: `apps/ios-expo/assets/splash.png` (2048×2048, cream bg + small ink BrandMark centered)
- Create: `apps/ios-expo/assets/adaptive-icon.png` (1024×1024, same as icon)

- [ ] **Step 1: Generate placeholder icon via Node script**

Create `apps/ios-expo/scripts/generate-placeholder-icon.cjs`:

```js
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

function drawBrandMark(ctx, size, ink = "#0E0E0E", cut = "#C8841C", bg = "#F5F1E8") {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.4;
  const mid = size * 0.25;
  const inner = size * 0.1;
  ctx.strokeStyle = ink;
  ctx.lineWidth = size * 0.025;
  ctx.beginPath(); ctx.arc(cx, cy, outer, 0, 2 * Math.PI); ctx.stroke();
  ctx.lineWidth = size * 0.012;
  ctx.beginPath(); ctx.arc(cx, cy, mid, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, 2 * Math.PI); ctx.stroke();
  ctx.strokeStyle = cut;
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + outer * 0.9, cy - outer * 0.55);
  ctx.stroke();
  ctx.fillStyle = cut;
  ctx.beginPath();
  ctx.arc(cx + outer * 0.9, cy - outer * 0.55, size * 0.04, 0, 2 * Math.PI);
  ctx.fill();
}

function emit(filename, size, ink = "#0E0E0E", cut = "#C8841C", bg = "#F5F1E8") {
  const c = createCanvas(size, size);
  drawBrandMark(c.getContext("2d"), size, ink, cut, bg);
  fs.writeFileSync(filename, c.toBuffer("image/png"));
  console.log(`Wrote ${filename}`);
}

const out = path.join(__dirname, "..", "assets");
emit(path.join(out, "icon.png"), 1024);
emit(path.join(out, "adaptive-icon.png"), 1024);
emit(path.join(out, "splash.png"), 2048);
```

- [ ] **Step 2: Install canvas as a dev dep (Windows-friendly via prebuilt binaries)**

```powershell
cd C:\Users\levin\rateradar\apps\ios-expo
npm install --save-dev canvas
```

If `canvas` fails to build on Windows (it sometimes does on Node 22+), fallback: use the existing PNG generation script pattern from Relatably:

```powershell
node -e "const fs=require('fs');const{PNG}=require('pngjs');function go(size,name){const p=new PNG({width:size,height:size});for(let y=0;y<size;y++){for(let x=0;x<size;x++){const i=(y*size+x)*4;p.data[i]=0xF5;p.data[i+1]=0xF1;p.data[i+2]=0xE8;p.data[i+3]=0xFF;}}p.pack().pipe(fs.createWriteStream(name));}go(1024,'./assets/icon.png');go(1024,'./assets/adaptive-icon.png');go(2048,'./assets/splash.png');"
```

(Solid cream squares — still passes Apple's icon validation; real BrandMark icon ships in Phase 5.)

- [ ] **Step 3: Run the generator**

```powershell
node scripts/generate-placeholder-icon.cjs
```

Verify three PNGs exist in `apps/ios-expo/assets/`. Open `icon.png` and `splash.png` in an image viewer to confirm they render the BrandMark on cream.

- [ ] **Step 4: Commit**

```
feat(ios): placeholder Wire Room icon + splash assets + generator script
```

---

## Task 5 — Core App.tsx + WebViewHost component

**Files:**
- Create: `apps/ios-expo/App.tsx`
- Create: `apps/ios-expo/src/WebViewHost.tsx`
- Create: `apps/ios-expo/src/lib/constants.ts`
- Create: `apps/ios-expo/src/hooks/useAppStatePause.ts`

- [ ] **Step 1: Write src/lib/constants.ts**

```ts
export const WEB_BASE_URL = "https://rateradar-web.vercel.app";

export const PRE_LOAD_BRIDGE = `
  window.NATIVE_PLATFORM = 'ios';
  window.NATIVE_RATERADAR = { version: '1.0.0', pushTokenPending: true };
  true;
`;
```

- [ ] **Step 2: Write src/hooks/useAppStatePause.ts**

```ts
import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

type Pauser = () => void;

export function useAppStatePause(onPause: Pauser, onResume?: Pauser) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        onResume?.();
      } else {
        onPause();
      }
    });
    return () => sub.remove();
  }, [onPause, onResume]);
}
```

- [ ] **Step 3: Write src/WebViewHost.tsx**

```tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { PRE_LOAD_BRIDGE, WEB_BASE_URL } from "@/lib/constants";

export interface WebViewHandle {
  pause: () => void;
  resume: () => void;
  reload: () => void;
}

interface WebViewHostProps {
  source?: string;
  testID?: string;
  onLoadEnd?: () => void;
}

export const WebViewHost = forwardRef<WebViewHandle, WebViewHostProps>(
  function WebViewHost({ source, testID, onLoadEnd }, ref) {
    const webRef = useRef<WebView | null>(null);

    useImperativeHandle(ref, () => ({
      pause: () => {
        webRef.current?.injectJavaScript(
          "try { window.dispatchEvent(new Event('rr-pause')); } catch (e) {} true;",
        );
      },
      resume: () => {
        webRef.current?.injectJavaScript(
          "try { window.dispatchEvent(new Event('rr-resume')); } catch (e) {} true;",
        );
      },
      reload: () => {
        webRef.current?.reload();
      },
    }));

    return (
      <WebView
        ref={webRef}
        testID={testID ?? "rr-webview"}
        source={{ uri: source ?? WEB_BASE_URL }}
        injectedJavaScriptBeforeContentLoaded={PRE_LOAD_BRIDGE}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        decelerationRate="normal"
        bounces
        onLoadEnd={onLoadEnd}
      />
    );
  },
);

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#F5F1E8" },
});
```

- [ ] **Step 4: Write App.tsx**

```tsx
import { useCallback, useEffect, useRef } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { useAppStatePause } from "@/hooks/useAppStatePause";
import { WebViewHost, WebViewHandle } from "@/WebViewHost";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const webRef = useRef<WebViewHandle | null>(null);

  const pause = useCallback(() => webRef.current?.pause(), []);
  const resume = useCallback(() => webRef.current?.resume(), []);

  useAppStatePause(pause, resume);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => {});
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  const onFirstPaint = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <WebViewHost ref={webRef} onLoadEnd={onFirstPaint} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1E8" },
});
```

- [ ] **Step 5: Typecheck**

```powershell
cd C:\Users\levin\rateradar\apps\ios-expo
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```
feat(ios): App.tsx + WebViewHost wrapping rateradar-web.vercel.app
```

---

## Task 6 — Jest setup + smoke tests

**Files:**
- Create: `apps/ios-expo/__tests__/WebViewHost.test.tsx`
- Create: `apps/ios-expo/__tests__/useAppStatePause.test.ts`

- [ ] **Step 1: Write WebViewHost.test.tsx**

```tsx
import { render } from "@testing-library/react-native";

import { WebViewHost } from "@/WebViewHost";

jest.mock("react-native-webview", () => {
  const React = require("react");
  return {
    WebView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
        reload: jest.fn(),
      }));
      return React.createElement("WebView", { ...props, ref });
    }),
  };
});

describe("WebViewHost", () => {
  it("renders the WebView with default URL", () => {
    const { getByTestId } = render(<WebViewHost />);
    const view = getByTestId("rr-webview");
    expect(view.props.source.uri).toBe("https://rateradar-web.vercel.app");
  });

  it("accepts an override source URL", () => {
    const { getByTestId } = render(<WebViewHost source="https://preview.example.com" />);
    const view = getByTestId("rr-webview");
    expect(view.props.source.uri).toBe("https://preview.example.com");
  });
});
```

- [ ] **Step 2: Write useAppStatePause.test.ts**

```ts
import { AppState, AppStateStatus } from "react-native";
import { renderHook } from "@testing-library/react-native";

import { useAppStatePause } from "@/hooks/useAppStatePause";

describe("useAppStatePause", () => {
  it("calls onPause when state changes to background", () => {
    const onPause = jest.fn();
    const onResume = jest.fn();

    const listeners: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evt: string, cb) => {
      listeners.push(cb as (s: AppStateStatus) => void);
      return { remove: jest.fn() } as any;
    });

    renderHook(() => useAppStatePause(onPause, onResume));

    listeners[0]!("background");
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();

    listeners[0]!("active");
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests**

```powershell
cd C:\Users\levin\rateradar\apps\ios-expo
npm test
```

Expected: both test files pass. If `jest-expo` complains about preset, ensure `package.json`'s `"jest": { "preset": "jest-expo" }` block is present.

- [ ] **Step 4: Commit**

```
test(ios): WebViewHost + useAppStatePause smoke tests
```

---

## Task 7 — Verify with Expo Go (manual checkpoint for Levin)

**Files:** none (verification step)

- [ ] **Step 1: Start Metro**

```powershell
cd C:\Users\levin\rateradar\apps\ios-expo
npx expo start
```

When Metro is up, press `s` to switch to Expo Go mode (not dev-client — Levin doesn't have a dev-client build yet).

- [ ] **Step 2: Surface QR code to Levin**

In chat:

> "Metro is running. Open Expo Go on your iPhone and scan the QR shown in the terminal at C:\Users\levin\rateradar\apps\ios-expo. The app should boot to the RateRadar homepage in a few seconds. Confirm the page renders correctly, swipe through, then come back here to approve Phase 2."

- [ ] **Step 3: Wait for Levin's response**

If approved: stop Metro, proceed to Task 8 (commit + push).
If a bug: triage. Common ones:
- "Network request failed" → Metro is on different LAN from iPhone. Use tunnel: `npx expo start --tunnel`.
- WebView blank → Check `WEB_BASE_URL` resolves on iPhone Safari. The web app must be live on `rateradar-web.vercel.app`.
- Status bar overlaps content → `SafeAreaView` should handle this. If it doesn't, check `app.json`'s `requireFullScreen` and `UIStatusBarStyle`.

---

## Task 8 — Push and request preview build (optional)

**Files:** none

- [ ] **Step 1: Push branch**

```powershell
cd C:\Users\levin\rateradar
git push origin ios-launch-v1
```

- [ ] **Step 2: Stop here**

Phase 2 ends. Phase 3 (native modules: push, widget, Live Activity) is the next plan. We do NOT trigger an EAS build in Phase 2 — that's reserved for Phase 5 (after native modules are in).

---

## Self-review notes

**Spec coverage:** Spec §5.2 lists `apps/ios-expo/` structure including `plugins/withWidgetExtension.js`, `plugins/withLiveActivity.js`, `native/`, `scripts/asc-*.mjs`. Those are Phase 3 + Phase 4 — intentionally NOT in this plan.

**Type consistency:** `WebViewHandle` interface is defined once in `WebViewHost.tsx` and consumed by `App.tsx` via the typed `useRef<WebViewHandle | null>(null)`.

**Placeholder scan:** Two intentional placeholders — `eas.projectId` (filled by `eas init` in Phase 4) and `ascAppId` (filled by `asc-create-app.mjs` in Phase 4). Both are clearly marked. No other placeholders.

**Risk note:** `pnpm install` at workspace root may try to hoist Expo's React 19.1.0 vs the web app's React 19 — if it fights, fall back to plain `npm install` in `apps/ios-expo/` and leave the iOS app out of the pnpm workspace.

---

**End of Plan 2.** Phase 3 plan to be written after Phase 2 ships.
