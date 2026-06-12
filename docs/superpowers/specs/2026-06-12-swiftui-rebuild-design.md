# RateRadar SwiftUI Rebuild — Design

**Date:** 2026-06-12
**Goal:** Replace the Expo/React-Native WebView shell (`apps/ios-expo`) with a fully native SwiftUI app built out of the existing scaffold in `apps/ios`, with **identical design and functionality**, and submit it as v1.1.0 (build 7) of the live App Store app `com.lawoflarge.rateradar` (ASC id 6768628917).

## Constraints (user-set)

- Design and functionality stay **exactly the same** as the current app (WebView of rateradar-web.vercel.app + native onboarding/ads).
- Monorepo stays; the Vercel web app stays untouched.
- No additional backend: the native app consumes the existing `/api/*` routes on `https://rateradar-web.vercel.app`.
- Submit a new version at the end.

## Architecture

- **Target:** `apps/ios` (XcodeGen, single app target, iOS 17.0+, SwiftUI only, `@Observable`, async/await). `apps/ios-expo` stays in the repo untouched; it simply stops being the shipping artifact.
- **Data:** `APIClient` (actor) against `GET /api/{fed|ecb}/probabilities` and `GET /api/meetings/{id}/history?window=60d`. Models already match the live API. All derived numbers (cumulative pricing, implied rate curves, divergence, conditional scenarios, 7d movement) are pure client-side math ported 1:1 from `apps/web/src/lib/{movement,scenario,policy-rates}.ts` and the page components.
- **Dependency:** Google Mobile Ads SDK via SPM (includes UMP). No other packages.

## Screens (1:1 mirror of the web pages as seen in the current WebView)

Dashboard `/`, Fed `/fed`, ECB `/ecb`, Meeting detail `/meeting/[id]`, Compare `/compare`, Scenarios `/scenarios`, Methodology, Glossary (+13 term pages), Brokers, About, Privacy, Not-found. Top NavBar mirrors the web exactly (sticky, cream/95 blur, BrandMark + wordmark, wrapping text links — same as the WebView shows today). Inline web AdSlots render nothing in the native app today and stay absent natively.

## Design system ("Wire Room", from `apps/web/src/app/globals.css`)

- Colors: cream `#F5F1E8`, cream-soft `#EFEADD`, ink `#0E0E0E`, ink-soft `#2B2B2B`, ink-mute `#6F6A60`, rule `#1A1A1A`, rule-soft `#C9C2B0`, cut amber `#C8841C` (+soft `#E9C281`, deep `#A06208`), hike rust `#A8312A` (+soft `#D88983`, deep `#7A1F1B`), hold sage `#3E5640`. Light mode only.
- Fonts bundled in-app: IBM Plex Serif (headlines), JetBrains Mono (all numerals/labels, tabular), Inter (body).
- Charts in Swift Charts replicating Recharts styling: probability history multi-line (224pt, fixed 0–100% Y, outcome colors keyed by delta_bps, dashed grid 12% ink) and implied-rate curve (single amber line with dots).

## Native feature parity (from `apps/ios-expo`)

- **Onboarding:** one-time screen, exact copy/layout (headline "When will they cut?", square black CTA "Enable rate-shift alerts" → push permission, "Not now" skip). Persisted in `UserDefaults` key `rr.onboarding.completed.v1`.
- **Ads:** AdMob app id `ca-app-pub-6563643868702361~4467051169`; anchored adaptive banner `…/6751953637` pinned at the bottom; interstitial `…/7124163774` with the exact policy: qualifying events = visits to meeting-detail and compare (deduped per route instance), show every 3rd event, max 3/session, ≥180s apart (lastShown persisted in `rr.interstitial.lastShownTs.v1`).
- **ATT/UMP ordering (Guideline 2.1 lesson):** first `scenePhase == .active` → +600ms → ATT request (only if `.notDetermined`) → UMP `requestConsentInfoUpdate` + `loadAndPresentIfRequired` → `GADMobileAds.start` → preload interstitial. Never at launch.
- **Push:** permission + APNs token plumbing only (token not uploaded), `aps-environment` entitlement, remote-notification background mode.
- **Misc:** keep-awake (`isIdleTimerDisabled`), portrait-only iPhone / iPad supported, status bar dark-on-light, `ITSAppUsesNonExemptEncryption=false`, `NSPrivacyTracking=true` privacy manifest with empty tracking domains + UserDefaults CA92.1, Google SKAdNetworkItems list (was empty in the Expo build — fixed here).

## Testing

- Unit tests: APIClient decoding (fixtures from live API), interstitial policy (ported from `__tests__/interstitialPolicy.test.ts`), movement math.
- Simulator verification with screenshots per screen, compared against the web rendering.

## Release

- `MARKETING_VERSION 1.1.0`, `CURRENT_PROJECT_VERSION 7`, team `R95M36AU2X`, manual signing (profile "RateRadar AppStore Auto").
- Archive + export + altool upload (same local-Mac path as v1.0.4), create new appStoreVersion 1.1.0 via asc tooling, copy v1.0.4 metadata with new whatsNew (6 locales), attach build 7, submit. Existing screenshots stay valid (design unchanged).

## Out of scope

Widgets, Watch, push *sending*, new features of any kind, openapi.yaml cleanup, removing `apps/ios-expo`.
