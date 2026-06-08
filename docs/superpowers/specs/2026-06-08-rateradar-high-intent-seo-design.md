# RateRadar — High-Intent SEO Pages Design (2026-06-08)

## Goal

Drive more **web organic search traffic** to RateRadar so the existing AdSense
surfaces earn more — by capturing the high-intent, recurring queries people
actually type around central-bank decisions (e.g. *"next fed meeting"*,
*"will the fed cut rates in september 2026"*). Build-once, auto-fresh via the
existing pipeline cron, deploy instantly, no App Store dependency.

## Why this lever (decision trail)

Ad revenue splits into two channels with very different ceilings:

- **Web (AdSense)** — 6 ad surfaces already live; finance content carries solid
  RPM; SEO surface is currently tiny (~30 pages, 15 glossary terms) → large
  headroom; deploys instantly.
- **iOS app (AdMob)** — the app is a **pure WebView wrapper** around the same
  web app. AdSense cannot legally run in the WebView (ToS), so the app's ad
  ceiling is structurally capped at 1 native banner + occasional interstitial.
  Per-user ad value is small and each install must be won via cost/featuring.

→ For equal effort, **web organic traffic** yields far more ad revenue than app
downloads. Among web SEO plays we picked **Approach A: repackage the existing
Fed/ECB data into high-intent query pages** over (B) adding more central banks
(blocked by the same paid forward-data wall that already forced ECB to
spot-anchored) and (C) a content/glossary treadmill (lower intent + RPM).

## Context & constraints

- **Data model covers only FED + ECB** (`BankCode = "FED" | "ECB"`,
  `apps/web/src/lib/types.ts`). No new data sources this round.
- **FED has real market-implied odds** (yfinance fed-funds futures). **ECB is
  spot-anchored only** — DFR + €STR, *no forward probabilities* (paid data
  unavailable). The ECB pages MUST stay honest: date + current rate + an
  explicit "forward odds unavailable" note. No fabricated cut probabilities.
- **Auto-fresh already works:** the pipeline cron writes real daily FED + ECB
  snapshots; pages use ISR (`revalidate`) so they stay current with no manual
  step.
- **Existing reusable building blocks** (confirmed in code): `getFedProbabilities()`,
  `getEcbProbabilities()`, `getMeetingById()` (`lib/data.ts`); `MeetingCountdown`,
  `ProbabilityTable`, `JsonLd` (with `schema-dts`), `AdSlot` components;
  env-driven `AD_SLOTS` (`lib/ad-slots.ts`); `AdSlot` returns `null` inside the
  iOS WebView (`window.NATIVE_PLATFORM === 'ios'`) → ToS-safe by construction.
- **`apps/web` has NO test runner** → verify via `pnpm --filter web build` +
  lint + visual (Playwright) + schema validation, not unit tests.
- **Web-only change.** Deploys via Vercel, reaches web + iOS-WebView users, does
  NOT touch the in-review native `v1.0.3`.
- **Honor `apps/web` CLAUDE.md:** strict TS (no `any`), don't regress Lighthouse
  mobile targets (Perf > 85, SEO > 95, A11y > 90), retail-first tone.

## Decisions taken (2026-06-08)

1. **Channel:** web organic traffic (not app downloads).
2. **Approach:** A — high-intent pages from existing Fed/ECB data.
3. **Domain:** stay on `rateradar-web.vercel.app` (capped authority + possible
   future 301 migration accepted; no domain step now).
4. **Analytics:** turn on PostHog key + Google Search Console **in parallel**,
   non-blocking — so we can see which pages rank and iterate. Not a gate.

## Scope

### Build

1. **`/fed` — always-fresh FOMC hub.**
   - `H1`: `Next FOMC Meeting: <Month DD, YYYY>` (nearest scheduled meeting).
   - Above the fold: `MeetingCountdown` + `ProbabilityTable` for the next
     meeting + a one-line plain-English summary
     (e.g. *"Markets price a 95% chance the Fed holds at 3.50–3.75%."*).
   - Section *"All <year> FOMC meetings"*: list each scheduled meeting with date
     + top outcome % linking to `/meeting/[id]`.
   - Short explainer paragraph linking to `/methodology`.
   - One `AdSlot` (new env slot `NEXT_PUBLIC_AD_SLOT_FED`).
   - JSON-LD: `FAQPage` (*"When is the next Fed meeting?"* → date;
     *"Will the Fed cut rates at the next meeting?"* → odds answer) +
     `BreadcrumbList`.
   - `canonical: /fed`, OG image, `revalidate = 300`.

2. **`/ecb` — always-fresh ECB hub (odds-free, honest).**
   - `H1`: `Next ECB Meeting: <Month DD, YYYY>`.
   - Above the fold: `MeetingCountdown` + current DFR + explicit
     *"Forward odds unavailable — spot-anchored"* note (mirrors methodology §6/§11).
   - Section *"All <year> ECB meetings"* list → `/meeting/[id]`.
   - One `AdSlot` (new env slot `NEXT_PUBLIC_AD_SLOT_ECB`).
   - JSON-LD: `FAQPage` (*"When is the next ECB meeting?"* → date) +
     `BreadcrumbList`. **No fabricated cut odds.**
   - `canonical: /ecb`, `revalidate = 300`.

3. **Retrofit `/meeting/[id]` for question intent (surgical).**
   - `generateMetadata` title/description reframed to the search query:
     - FED: `Will the Fed cut rates on <short date>?` + description stating the
       actual odds (*"Markets price a 95% hold; a cut is priced at 3%."*).
     - ECB: `ECB rate decision <short date>: what to expect` (no odds claim).
   - Add an `<h2>` question heading near the top.
   - Add `FAQPage` JSON-LD (the title question → plain-English answer).
   - Keep all existing content + components. No URL change, no duplicate content.

4. **Discoverability plumbing.**
   - Add `/fed` + `/ecb` to `sitemap.ts` (high priority, `changeFrequency` daily).
   - Link `/fed` + `/ecb` from the homepage + `NavBar`.
   - Create 2 AdSense display units; set `NEXT_PUBLIC_AD_SLOT_FED` +
     `NEXT_PUBLIC_AD_SLOT_ECB` as Vercel production env (follow-up, gated on
     explicit user OK per session). `AdSlot` renders `null` on an empty slot →
     merge-safe before the units exist.

### Don't build (YAGNI)

- No new central banks (paid-data wall → thin pages).
- No content/glossary treadmill this round.
- No new data source, no new ad formats, no native rebuild.
- No custom domain / migration.

## SEO mechanics (how a tiny site punches above its authority)

- **Exact-match intent** in `H1`/`title`/`meta` — the language users search, not
  *"markets price 95% to hold"*.
- **Structured data for featured snippets / People-Also-Ask:** `FAQPage` with the
  literal question + a concise answer (date + %) is exactly what Google lifts
  into snippets — the main lever for a low-authority site.
- **Freshness:** ISR + the existing cron keep the date/odds current; Google
  favors fresh, precise answers to time-sensitive queries.
- **Long-tail focus:** month/year variants over the head term "fed rate", where
  CME FedWatch / Investing.com are weak.
- **Internal linking + canonicals** so the hubs accumulate authority and don't
  cannibalize the homepage (distinct intent: homepage = dual-bank overview;
  `/fed` = FOMC-specific deep page).

## Architecture & files

- New routes: `apps/web/src/app/fed/page.tsx`, `apps/web/src/app/ecb/page.tsx`.
- New pure helper `pickNextMeeting(meetings): MeetingProbabilities | null` in
  `lib/data.ts` (nearest meeting with `meeting_date >= today` /
  `status === "scheduled"`); pages fetch then pick → no double fetch.
- Reuse `MeetingCountdown`, `ProbabilityTable`, `JsonLd`, `AdSlot`, `AD_SLOTS`.
- Add `AD_SLOTS.fed` / `AD_SLOTS.ecb` reading the two new env vars.
- Edit `meeting/[id]/page.tsx` `generateMetadata` + add FAQ JSON-LD + `<h2>`.
- Edit `sitemap.ts`, homepage, `NavBar`.

## Verification & success criteria

**Pre-merge (deterministic):**
- `pnpm --filter web build` green + `lint` clean (strict TS, no `any`).
- Visual Playwright check of `/fed` + `/ecb` + a retrofitted meeting page.
- Schema valid in Google Rich Results Test (FAQ renders).
- Lighthouse SEO not regressed (≥ 95).

**Post-ship (measured, the real goal):**
- `/fed` + `/ecb` indexed; sitemap submitted in GSC.
- Within 2–6 weeks: GSC impressions/clicks for target queries
  (*"next fed meeting"*, *"will the fed cut rates …"*) trending up.
- AdSense impressions appearing on the new URLs.

## Enablers (non-blocking) & risks

- **Analytics (parallel):** set `NEXT_PUBLIC_POSTHOG_KEY` + verify the domain in
  Google Search Console + submit sitemap. Cheap; without it we optimize blind.
- **Domain (accepted risk):** `*.vercel.app` caps authority; a later custom-domain
  move is a 301 migration with ranking risk. Logged, deferred by choice.
- **Thin-content / doorway risk:** each page must carry genuine unique value
  (live odds, countdown, meeting list, explainer) — not keyword stuffing.
- **ECB odds-free** → lower value than FED pages, still worth it for the date
  query; must not fabricate probabilities.
- **Homepage cannibalization** → mitigated via canonicals + distinct intent.
