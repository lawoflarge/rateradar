# RateRadar — Growth & Ad-Revenue Design (2026-06-01)

## Goal

Drive more app usage and downloads and maximize ad revenue for RateRadar, by
fixing real bugs/UX flaws, improving SEO/ASO/shareability, and adding ad
surfaces — without violating AdSense/AdMob policy, regressing Lighthouse
targets, or disrupting the in-review native iOS build.

## Context & constraints

- **Architecture:** The Next.js web app (`apps/web`, on Vercel) is the product
  core. The iOS app (`apps/ios-expo`) is a **pure WebView wrapper** around that
  web app + native AdMob (banner + interstitial). AdSense is suppressed inside
  iOS via `window.NATIVE_PLATFORM === 'ios'`.
- **Web changes deploy instantly via Vercel** and reach BOTH web visitors and
  iOS-WebView users with **no App Store review**. This is the high-leverage,
  low-risk path → Phase 1 is web-only.
- **A native build is currently in App Review:** `v1.0.2 build 4` (interstitial),
  `WAITING_FOR_REVIEW`. Do **not** start a native rebuild this round; it would
  collide with that submission. Native work is Phase 3, after v1.0.2 clears.
- **Revenue streams:** AdSense (web), AdMob (iOS native), broker referrals
  (`/brokers`). Broker affiliate links are placeholders pending partner
  approvals → broker monetization is externally blocked, out of scope here.
- **Honor `apps/web` CLAUDE.md:** strict TS (no `any`), Lighthouse mobile
  targets (Perf > 85, SEO > 95, A11y > 90) must not regress, retail-first tone,
  keep the historical-tracking differentiator central.

## Decisions taken (2026-06-01)

- **Scope:** Web + native allowed overall, but **Phase 1 = web-only**; native
  deferred to Phase 3.
- **Analytics (PostHog):** **Out of scope this round.** No project key available.
  Ad optimization will rely on AdSense/AdMob dashboards, not an own event
  baseline. (`apps/web/src/lib/analytics.ts` stays as-is intentional scaffolding.)
- **Ad density:** Aggressive — one tasteful responsive unit on each of 4 new
  pages **plus** a sticky-anchor footer ad, with bounce/UX watched.
- **Browser verification:** Safari (explicitly authorized for this work).
- **Autonomy:** Design approved → execute Phase 1 autonomously (own branch/PR,
  verify), check in only at real forks.

## Audit findings that were verified and DROPPED (do not implement)

These came back from the audit but were checked against the code and are NOT
real issues — recorded so they don't get re-introduced:

- **MovementChip "tone reversed"** — `MovementChip.tsx:30-31` deliberately uses
  green-up/red-down and the comment states it intentionally does NOT color by
  hawkish/dovish. Working as designed. **Not a bug.**
- **iOS banner "uses test unit id"** — `ads.ts:16` test id is only a fallback;
  the real unit is injected at build via `EXPO_PUBLIC_ADMOB_*` and verified baked
  in the live bundle. **Not a live bug.**
- **Analytics no-op "critical bug"** — real that `initAnalytics()` is a no-op,
  but it is intentional scaffolding gated on a missing env key, not a defect.
  Deferred by decision above.

---

# Phase 1 — Web, instant deploy (THIS ROUND)

Each item is independently shippable. All on branch `feat/web-growth-revenue`,
one PR. Verify on local dev + Safari before/after; keep Jest green; watch
Lighthouse.

## 1. Bug & UX fixes (Priority 1)

### B1 — MeetingCountdown timezone bug
- **File:** `apps/web/src/components/MeetingCountdown.tsx` (~line 16)
- **Problem:** `new Date(meetingDate + "T00:00:00")` parses in the viewer's local
  timezone, so the day-count differs by region for the same meeting.
- **Fix:** Anchor to UTC — `new Date(meetingDate + "T00:00:00Z")`.
- **Verify:** Unit test asserting identical day-count regardless of `TZ`; visual
  check the homepage countdown.

### B2 — HistoricalChart renders empty outcome series
- **File:** `apps/web/src/components/HistoricalChart.tsx` (~lines 68-100)
- **Problem:** Legend + `<Line>` render for outcomes whose `series` has zero
  points → blank lines + legend items with no data, confusing on incomplete data.
- **Fix:** Filter `visibleLabels` / lines to outcomes with `series.length > 0`.
- **Verify:** Component test with a fixture mixing populated + empty series;
  assert empty ones don't render.

### B3 — ScenarioBuilder empty/stale outcome state — DROPPED (verified safe during planning)
- `ScenarioBuilder.tsx` already guards `snapshots.length === 0` (renders
  "No meetings available for this bank yet.", line 88) and uses optional-chaining
  with `outcomes[0]` fallbacks throughout. The ECB toggle is disabled when ECB is
  empty, so there is no switch-to-empty crash path and no stale selection.
  **No real defect. No change.**

### B4 — AdSlot push lifecycle — DROPPED (marginal; current code is correct)
- `pushed` is a per-`<ins>` instance ref, which is exactly correct AdSense usage:
  one `adsbygoogle.push({})` per slot element. The "wasted requests" claim does
  not hold. iOS suppression already correct. **No change.** (Adding 5 more slots
  in A1 reuses this component as-is.)

## 2. SEO / ASO / Share (Priority 2)

### S1 — JSON-LD structured data (biggest organic lever; currently none)
- **Add `Organization`** site-wide (in `apps/web/src/app/layout.tsx`).
- **Add `FAQPage`** on `/glossary` built from the existing `TERMS` array.
- **Add `Article` + `BreadcrumbList`** on `/meeting/[id]` (`datePublished` from
  snapshot time, `author` = RateRadar org).
- **Add `Dataset`** on `/methodology` (and/or home) describing the historical
  probability snapshots — surfaces the differentiator to data search.
- **Implementation:** A small typed helper that renders a
  `<script type="application/ld+json">` with validated objects (no `any`).
- **Verify:** Google Rich Results structural sanity (valid JSON-LD shape);
  snapshot test of emitted JSON.

### S2 — OG / Twitter images for static pages
- **Problem:** Only `/meeting/[id]` has an OG image; homepage + static pages
  unfurl without an image → ~2-3× fewer social clicks.
- **Fix:** Add a default 1200×630 OG image (reuse the meeting-OG visual
  language; a static asset or an `/api/og/default` route) and wire it as the
  fallback `openGraph.images` + `twitter.images` in `layout.tsx`; add missing
  `openGraph` to `/brokers` and `/privacy`.
- **Verify:** Inspect rendered `<head>` for og:image/twitter:image on each page;
  Safari/social-debugger unfurl spot-check where feasible.

### S3 — iOS download routing from web (Smart App Banner + AASA)
- **Add** `<meta name="apple-itunes-app" content="app-id=6768628917">` in
  `layout.tsx` → iOS Safari shows a native "Download" banner to web visitors.
- **Add** `apps/web/public/.well-known/apple-app-site-association` with the app's
  bundle id so links can deep-link rather than open Safari. (No native rebuild
  needed for the meta banner; AASA fully effective once the app declares
  Associated Domains — document that as a Phase 3 follow-up, ship the web side now.)
- **Verify:** AASA served with correct `application/json` and no redirect;
  meta tag present in `<head>`.

### S4 — Metadata gaps
- **Homepage** (`apps/web/src/app/page.tsx`): add an explicit `metadata` export
  with title/description + `alternates.canonical: "/"`.
- **`/brokers`, `/privacy`:** add `openGraph` objects.
- **Verify:** `<head>` inspection; no duplicate canonicals.

## 3. Ad revenue (Priority 3) — web, instant

### A1 — Expand AdSense from 1 → 5 surfaces + sticky anchor
- **Pages:** add one responsive `<AdSlot>` below the main content on
  `/meeting/[id]`, `/compare`, `/scenarios`, `/glossary` (homepage already has
  one). Each placement gets its **own AdSense unit id** (created in the AdSense
  console via Safari) for clean per-placement reporting.
- **Plus a sticky-anchor footer ad** (one site-wide unit), implemented so it
  does not obscure >30% of viewport and reserves space to avoid CLS. Treat it as
  a watch-item: monitor bounce; easy to disable if it hurts UX.
- **Guardrails:** reserve slot height to avoid layout shift; keep iOS suppression
  via `window.NATIVE_PLATFORM`; do not place ads above primary content; respect
  AdSense spacing rules; re-check Lighthouse mobile Perf ≥ 85 after.
- **Verify:** Each page renders exactly one in-content unit (zero inside the iOS
  WebView); sticky anchor appears/dismisses correctly; Lighthouse mobile not
  regressed; AdSense policy spot-check.

> **Note:** PostHog/ad-event tracking (originally "A2") is **cut** this round by
> decision. No analytics wiring in Phase 1.

## Phase 1 verification gate (definition of done)

> **Note (verified during planning):** `apps/web` has **no test runner** (no Jest/
> Vitest, zero test files). Adding one was deemed out of scope in a prior session.
> Phase 1 verification is therefore **build + lint + visual (Safari) + Lighthouse +
> structured-data validation**, not unit tests. A test runner is a separate Phase 2
> infra item.

- `pnpm --filter web build` green (Next.js typecheck); `pnpm --filter web lint` clean.
- TypeScript strict, no `any`.
- Lighthouse mobile (homepage + one meeting page): Perf ≥ 85, SEO ≥ 95, A11y ≥ 90.
- Safari visual pass: homepage, a meeting page, `/compare`, `/scenarios`,
  `/glossary` — B1 (timezone) + B2 (chart) confirmed fixed, ad units render
  outside the WebView only, structured data present in `<head>`.
- One PR off `origin/main`; conventional commits; CI green.

---

# Phase 2 — Web, medium effort (FUTURE CYCLE, own spec/plan)

- **Programmatic glossary term pages** `/glossary/[term]` via
  `generateStaticParams` over `TERMS`, each with unique metadata + internal
  links + `DefinedTerm` schema, added to `sitemap.ts`. Long-tail organic.
- **Richer meeting schema** (`NewsArticle`) + visible breadcrumb UI.
- **Additional ad formats**: matched-content / in-feed units on high-traffic
  pages (careful labeling + CLS), evaluate sticky-anchor A/B results.
- **Broker contextual CTAs** on `/compare` and `/meeting/[id]` — **blocked** on
  live affiliate links (external dependency).

# Phase 3 — Native iOS (FUTURE CYCLE, after v1.0.2 clears review)

- Expand interstitial qualifying routes (`/scenarios`, `/glossary`) in
  `NativeNavBridge`.
- App-Open-Ad on app resume (AdMob), frequency-capped.
- Declare Associated Domains so AASA deep-links activate.
- New marketing version build + resubmit via the local Mac pipeline
  (`reference-ios-local-mac-build`). Bundle any web feature that needs native.

## Out of scope (per product non-negotiables / decisions)

- No scraping/mirroring CME FedWatch or ECB Watch.
- No user accounts / auth.
- No real-time tick data.
- No Android / BoE / BoJ.
- No PostHog wiring this round.
- No native rebuild this round.
