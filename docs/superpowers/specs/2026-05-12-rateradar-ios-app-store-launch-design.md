# RateRadar iOS — App Store Launch Design

**Status:** Approved 2026-05-12 (Levin)
**Owner:** Levin Schwab
**Goal:** Ship RateRadar to the iOS App Store with a Wire-Room design refresh, native iOS features (push, widget, Live Activity), and a multi-hour autonomous build → submit pipeline.

## 1. Strategic call

Drop the half-built Swift/SwiftUI scaffold at `apps/ios/RateRadar/`. It has no Xcode project, no DEVELOPMENT_TEAM, no real charts/services wiring — finishing it would be weeks.

Ship instead with the **Titi & Bina pattern**: Expo SDK 54 + react-native-webview wrapping the live Next.js site at `rateradar-web.vercel.app`. Single backend, single codebase, days not weeks.

To pass Apple guideline 4.2 (anti-WebView-wrapper rule), bolt on native iOS features the web cannot have:

1. **Push notifications** — probability-shift alerts (e.g., "Fed rate-cut probability +8% today")
2. **WidgetKit home-screen widget** — small/medium variants, shows next meeting + live probability bar
3. **Live Activity** during FOMC/ECB meeting day — Dynamic Island real-time updates
4. **Native share extension** (stretch goal — cut if blocker)

The existing `apps/ios/RateRadar/` Swift scaffold is left in place but unused, for option-value later. New iOS code lives at `apps/ios-expo/`.

## 2. Visual identity — "Wire Room"

Bloomberg-meets-NYT-Sunday-Business. Serious, editorial, data-first. No glassmorphism, no gradients, no AI slop.

- **Base:** paper-cream `#F5F1E8`
- **Ink:** deep `#0E0E0E`
- **Rate-cut accent:** amber `#C8841C`
- **Rate-hike accent:** crimson `#A8312A`
- **Hairline rule:** `#1A1A1A` at 0.5pt
- **Typography:**
  - Numbers + tickers + percentages: **JetBrains Mono** (free, OFL)
  - Editorial headlines: **IBM Plex Serif** (free, OFL)
  - UI body + labels: **Inter** (free, OFL)
- **Layout primitives:** fine horizontal rules between sections, small caps for section labels, generous white space, no card shadows, no rounded corners on data tables (4pt corners only on touch targets).

Applied to:
- Web (full refresh across all pages on a branch → preview → main)
- iOS WebView (inherits web design)
- Native widget surface (Swift renders matching tokens)
- Push notification copy + push-test images
- App icon + screenshots

## 3. Naming & identity

- **App Store name:** `RateRadar`
- **Subtitle:** `Fed & ECB Odds`
- **Bundle ID:** `com.lawoflarge.rateradar`
- **Apple Team:** `R95M36AU2X`
- **ASC API key:** `8XWLD2B2RQ` (reused; key file copied to `apps/ios-expo/.secrets/`)
- **Tagline:** "When will they cut?"

## 4. Monetization

- **Free + AdMob banner**, flag `EXPO_PUBLIC_ADMOB_ENABLED=false` for v1.0 submission, flip `true` after Apple approval.
- AdMob unit IDs use Google's published test IDs until first real campaign.
- Broker affiliate links already live on the web `/brokers` page; iOS users hit them via the WebView naturally — no new code needed.
- No IAP, no subscription, no third-party SDKs that trigger App Privacy "tracking".

## 5. Architecture

### 5.1 Web (apps/web/, existing)
- Next.js 16, App Router, deployed to `rateradar-web.vercel.app`
- Refreshed design tokens at `apps/web/src/styles/tokens.css` + new `Theme.tsx` provider
- All pages refactored to the Wire-Room aesthetic
- OG images regenerated at `/api/[bank]/og` and `/api/meetings/[id]/og`
- Performance budget: Lighthouse mobile ≥ 90 across Performance/Accessibility/Best-Practices/SEO

### 5.2 iOS app (apps/ios-expo/, new)
- Expo SDK 54, React Native 0.81.5, React 19.1.0
- `react-native-webview` loads `https://rateradar-web.vercel.app` (or the deploy URL during preview)
- Top-level structure:
  ```
  apps/ios-expo/
    app.json
    eas.json
    codemagic.yaml
    package.json
    metro.config.js
    babel.config.js
    src/
      App.tsx
      WebViewHost.tsx          # main WebView wrapper
      lib/
        notifications.ts        # Expo Notifications init + token registration
        ads.ts                  # AdMob env-gated adapter (Relatably pattern)
        deeplinks.ts            # parse rateradar:// scheme + meeting URLs
        api.ts                  # native pulls from /api/[bank]/probabilities for widget refresh
      hooks/
        useAppState.ts          # pause-on-background
    plugins/
      withWidgetExtension.js    # config plugin: WidgetKit extension
      withLiveActivity.js       # config plugin: Live Activity entitlement + Info.plist
      withPrivacyManifest.js    # PrivacyInfo.xcprivacy (no tracking, no IDFA)
    native/
      RateRadarWidget/          # Swift WidgetKit extension source
        RateRadarWidget.swift
        ProbabilityProvider.swift
        WidgetEntryView.swift
      LiveActivity/
        RateActivityAttributes.swift
        RateActivityView.swift
    assets/
      icon.png                  # 1024×1024 master
      adaptive-icon.png
      splash.png
    .secrets/
      AuthKey_8XWLD2B2RQ.p8    # gitignored
    scripts/
      asc-create-app.mjs       # one-shot: register app + bundle ID
      asc-fill-metadata.mjs    # idempotent metadata fill
      asc-upload-screenshots.mjs
      asc-submit-for-review.mjs
      asc-finalize-submission.mjs
      asc-list-builds.mjs
      asc-revoke-distribution-certs.mjs
      asc-browser-cdp.cjs
      asc-do.cjs
    archive/
      screenshots/              # generated 1290×2796 + 1242×2688 PNGs
  ```

### 5.3 Native modules (the Apple 4.2 differentiators)

**WidgetKit extension** (Swift, via `plugins/withWidgetExtension.js` config plugin)
- Two timeline entries:
  - Small: "FOMC · Jun 18 · 67% hold" with a 7-step probability bar
  - Medium: full probability table for the next meeting
- Refresh policy: `TimelineProvider` requests next entry every 30 min; reads from a shared `App Group` container or fetches `/api/[bank]/probabilities` directly
- Tap intent: deep-links into the app at `rateradar://meeting/<id>`

**Live Activity** (Swift, via `plugins/withLiveActivity.js`)
- Triggers on FOMC/ECB meeting days only (`NSSupportsLiveActivities` + `ActivityKit`)
- Dynamic Island compact: tickers `FED 67%·` ; expanded: full probability bar + "decision in 2h 14m"
- Push-update via APNs `liveactivity` push type (server-side, defer to v1.0.1 if too risky)
- **De-risk path:** ship v1.0 with widget only; Live Activity in v1.0.1 if widget alone burns the budget.

**Push notifications** (Expo Notifications)
- APNs token registered on first launch
- Stored in Supabase `device_tokens` table with `last_seen_at`
- Trigger: Supabase Edge Function on probability shift > 5% (per-bank, per-meeting)
- Notification copy: "Fed · rate-cut probability +8% today · 67% → 75%"
- User can configure threshold + per-bank toggles in `/settings` (WebView)

## 6. CI/CD

- **Build:** Codemagic free tier, `mac_mini_m2`, integration name `rateradar-asc`
- **`codemagic.yaml`** copied from `relatably/codemagic.yaml` with bundle/app id swaps; all 10 gotchas from `infra_codemagic_ios.md` pre-applied:
  - Corepack disable + fresh pnpm install
  - No `timeout` command
  - `--certificate-key @file:`
  - Fresh RSA key + `--create` cert flow
  - Pre-step: revoke stale distribution certs
  - `get-latest-build-number` over `-app-store-build-number`
  - **Mirror `eas.json` env vars into `codemagic.yaml`'s `environment.vars`**
  - **`app.json` must have `expo.icon: "./assets/icon.png"`** — verified via `asc-list-builds.mjs` after build
- **Webhook is broken on `lawoflarge/*` repos** — every Codemagic build requires Levin's manual "Start build" click. Don't promise auto-trigger.

## 7. ASC submission flow

Reuse Relatably's permanent scripts pattern. Each script idempotent, run from `apps/ios-expo/`.

1. `asc-create-app.mjs` — one-shot: POST `/v1/apps` with bundle + name + primary locale + SKU; capture `appStoreApp.id` → write to `.env.local` as `ASC_APP_ID`.
2. Add capabilities (Push Notifications, ApplicationGroups for widget data sharing) via Apple Developer Portal API.
3. Codemagic build → IPA uploaded → ingested as ASC build (state VALID).
4. `asc-fill-metadata.mjs` — name, subtitle, keywords, description, promotional text, support/marketing URLs, copyright `© 2026 Levin Schwab`, `usesIdfa=false`, Review Notes (4-line: "no login required, content is public market data, no in-app purchases, contact levin.schwab@gmx.de"), age rating questionnaire (computed `FOUR_PLUS` likely).
5. `asc-upload-screenshots.mjs` — 4× `APP_IPHONE_67` (1290×2796) + 4× `APP_IPHONE_65` (1242×2688). Note: Apple has not added `APP_IPHONE_69` enum; 1290×2796 goes in `_67`.
6. `asc-finalize-submission.mjs` — Pricing schedule (Free + all 175 territories via `/v1/apps/{id}/appPricePoints` + POST `/v1/appPriceSchedules`); Content Rights = `DOES_NOT_USE_THIRD_PARTY_CONTENT`; `demoAccountRequired=false`.
7. App Privacy via Playwright (no API for the questionnaire UI). Data types: Device ID (push token), Product Interaction. Both linked-to-user, NOT for tracking, purpose = App Functionality.
8. `asc-submit-for-review.mjs` — create reviewSubmission with v1.0 item, PATCH `submitted=true`. State flips to `WAITING_FOR_REVIEW`. **Autonomous submit per Levin's choice.**

## 8. Screenshots strategy

Generate via Playwright against the refreshed web design, at iPhone viewports:
- 1290×2796 (iPhone 15/16 Pro Max range) → bucket `APP_IPHONE_67`
- 1242×2688 (iPhone XS Max range) → bucket `APP_IPHONE_65`

Four screens captured each size:
1. Homepage hero with "Next decision" card
2. Per-meeting detail with probability table + history chart
3. Compare page (Fed vs ECB)
4. "Wire Room" branded hero card with tagline + widget mockup overlay

Optionally add a single text caption per screenshot ("Track Fed odds in real time", etc.) baked into the PNG.

## 9. Risks + mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Apple 4.2 rejection (pure WebView wrapper) | Medium | Native widget + push notifications make the app legitimately native |
| WidgetKit config plugin complexity blows up timeline | Medium | Cut Live Activity from v1.0; if widget itself bogs, ship push-only v1.0 + widget v1.0.1 |
| Codemagic webhook broken (gotcha #9) | High | Every build needs Levin's manual click — surface this explicitly in checkpoints |
| Apple `Ungültige Binärdatei` from missing `expo.icon` (gotcha #10) | High | First commit to `app.json` sets `expo.icon` field; verified post-build via iconAssetToken |
| EAS quota exhausted | Already known | Codemagic-only from day one (free tier 500 mac-mins/mo, plenty for ~30 builds) |
| AdMob env var missing in Codemagic (gotcha #8) | High | Mirror `eas.json`'s env block into `codemagic.yaml`'s `environment.vars` at scaffold time |
| Push notification certs/keys confusion | Medium | Use APNs Auth Key (.p8) not certs — works across all of Levin's apps under team `R95M36AU2X` |
| Probability-shift Supabase Edge Function never deploys | Low | v1.0 ships with notification permission flow + token registration only; first shift alert can be triggered manually post-launch |

## 10. Stage plan (autonomous run from approval)

| # | Phase | ~Time | Mode | Checkpoint |
|---|-------|-------|------|-----------|
| 1 | Web design refresh (Wire Room) | 90 min | autonomous | Levin eyeballs Vercel preview |
| 2 | Expo iOS scaffold + WebView | 90 min | autonomous | jest green + Expo Go on Levin's iPhone |
| 3 | Native widget + push (Live Activity stretch) | 150 min | autonomous | TestFlight via first Codemagic build |
| 4 | ASC app record + Codemagic config | 45 min | autonomous | App appears in ASC dashboard |
| 5 | Build + screenshots + metadata + submit | 90 min | mixed | Levin clicks Codemagic "Start build" once; I submit autonomously after build VALID |
| 6 | Wait | 24-48h | passive | Apple email to levin.schwab@gmx.de |

## 11. Out of scope for v1.0

- Apple Watch complication
- Sign in with Apple (no user accounts needed; settings stored locally)
- Apple Pay / IAP / subscription
- Android app
- Embeddable chart widgets for third-party blogs
- True CME-style conditional probabilities (math work in `docs/METHODOLOGY.md §10`)
- Live Activity if widget burns the time budget
- Custom widget configuration UI (ships with sensible defaults)

## 12. Definition of done

- v1.0 binary on TestFlight, installable on Levin's iPhone, passes visual + functional smoke test
- ASC `appStoreState=WAITING_FOR_REVIEW` and `reviewSubmissionState=WAITING_FOR_REVIEW`
- Submitted timestamp logged + email confirmation from Apple to levin.schwab@gmx.de
- Memory updated: `project_rateradar.md` with new launch status and resume notes; `infra_codemagic_ios.md` with any new gotchas
- Web design refresh merged to `main` and deployed to `rateradar-web.vercel.app`

## 13. References

- Existing project memory: `project_rateradar.md`
- Launch playbook source: `project_bibi_tina_game.md`, `project_relatably.md`
- CI playbook: `infra_codemagic_ios.md`
- Propagation reference: `reference_app_store_propagation.md`
- Repo: https://github.com/lawoflarge/rateradar (private)
- Web: https://rateradar-web.vercel.app
- Supabase project: `nzuovghfjxnbnraxxkej` (eu-central-1)
