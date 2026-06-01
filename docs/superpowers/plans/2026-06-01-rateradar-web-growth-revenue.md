# RateRadar Web Growth & Ad-Revenue — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship web-only fixes + SEO/ASO + ad-surface expansion that increase RateRadar usage, downloads, and ad revenue — deployed instantly via Vercel, reaching both web and iOS-WebView users, without a native rebuild.

**Architecture:** All changes are in `apps/web` (Next.js App Router, on Vercel). Bug fixes are surgical edits to existing components. SEO adds JSON-LD + metadata + a default OG image route. Ad expansion reuses the existing `AdSlot` component on 4 more pages plus a new sticky-anchor unit. The iOS app is a WebView wrapper, so web changes propagate to it automatically; AdSense stays suppressed in-app via `window.NATIVE_PLATFORM === 'ios'`.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript strict, Tailwind, `next/og` (ImageResponse), Google AdSense, pnpm workspace.

**Branch:** `feat/web-growth-revenue` (already created off `origin/main`). One PR at the end.

**Verification reality:** `apps/web` has **no test runner**. Verification per task = `pnpm --filter web build` (typecheck) + `pnpm --filter web lint` + Safari visual check + (final) Lighthouse + Google Rich Results structural check. Do not introduce a test framework in this plan.

**Commands (run from repo root `~/Data/Claude/rateradar`):**
- Build: `pnpm --filter web build`
- Lint: `pnpm --filter web lint`
- Dev server: `pnpm --filter web dev` (http://localhost:3000)

---

## Task 1: B1 — Fix MeetingCountdown timezone bug

**Files:**
- Modify: `apps/web/src/components/MeetingCountdown.tsx:16`

- [ ] **Step 1: Apply the UTC anchor**

In `computeLabel`, change the date parse from local-time to UTC so the day-count is identical for every viewer regardless of timezone.

Replace line 16:
```ts
  const target = new Date(meetingDate + "T00:00:00").getTime();
```
with:
```ts
  // Anchor to UTC midnight so the day-count is identical for every viewer
  // regardless of their local timezone (Fed/ECB dates are calendar dates).
  const target = new Date(meetingDate + "T00:00:00Z").getTime();
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Visual check**

Run `pnpm --filter web dev`, open http://localhost:3000 in Safari, confirm the homepage "next decision" countdown renders a sensible "in N days"/"Tomorrow"/"Today". (Optional cross-check: run the dev server with `TZ=Asia/Tokyo pnpm --filter web dev` and confirm the day-count is unchanged vs default TZ.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MeetingCountdown.tsx
git commit -m "fix(web): anchor MeetingCountdown to UTC so day-count is timezone-stable"
```

---

## Task 2: B2 — HistoricalChart: don't render empty outcome series

**Files:**
- Modify: `apps/web/src/components/HistoricalChart.tsx:84` (and the legend/line consumers)

**Why:** `visibleLabels` and the legend iterate `series` directly, so an outcome with zero historical points shows a legend dot + a blank `<Line>`. Derive a `populatedSeries` (only outcomes with ≥1 point) and use it for both the legend and the lines.

- [ ] **Step 1: Add a populatedSeries memo**

Immediately after the `chartData` `useMemo` block (ends at line 82), and replacing the `visibleLabels` line (84), insert:
```ts
  // Only outcomes that actually have historical points should appear in the
  // legend and as chart lines — otherwise an outcome with no snapshots yet
  // renders a legend dot with no corresponding line.
  const populatedSeries = useMemo(
    () => series.filter((s) => s.series.length > 0),
    [series],
  );
  const visibleLabels = useMemo(
    () => populatedSeries.map((s) => s.label),
    [populatedSeries],
  );
```
Remove the old line 84 (`const visibleLabels = useMemo(() => series.map((s) => s.label), [series]);`).

- [ ] **Step 2: Point the legend at populatedSeries**

In the legend block, change line 108 from:
```tsx
          {series.map((s) => {
```
to:
```tsx
          {populatedSeries.map((s) => {
```

- [ ] **Step 3: Point the line lookup at populatedSeries**

In the `<Line>` map (line 168-170), change the `delta` lookup source from `series` to `populatedSeries`:
```tsx
            {visibleLabels.map((label) => {
              const delta =
                populatedSeries.find((s) => s.label === label)?.delta_bps ?? 0;
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web build`
Expected: build succeeds, no TS errors.

- [ ] **Step 5: Visual check**

In Safari open a meeting detail page (homepage → first meeting → scroll to "Probability history"). Confirm the chart + legend render and every legend item has a corresponding line.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/HistoricalChart.tsx
git commit -m "fix(web): HistoricalChart skips outcomes with no historical points"
```

---

## Task 3: S4 — Close metadata gaps (homepage canonical, brokers/privacy OG)

**Files:**
- Modify: `apps/web/src/app/page.tsx` (add a `metadata` export)
- Modify: `apps/web/src/app/brokers/page.tsx` (add `openGraph`)
- Modify: `apps/web/src/app/privacy/page.tsx` (add `openGraph`)

- [ ] **Step 1: Add homepage metadata export**

At the top of `apps/web/src/app/page.tsx`, after the existing imports, add (keep the existing default export untouched):
```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fed + ECB rate-decision probabilities, with history",
  description:
    "Live market-implied probabilities for Fed and ECB interest-rate decisions, with 60 days of historical charts showing how expectations shifted into each meeting.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "RateRadar · Fed + ECB rate-decision probabilities",
    description:
      "See where rates are headed before the meeting. Fed + ECB probabilities with historical tracking.",
    type: "website",
  },
};
```
> If `page.tsx` already imports `type { Metadata }`, do not duplicate the import.

- [ ] **Step 2: Add openGraph to brokers**

In `apps/web/src/app/brokers/page.tsx`, extend the existing `metadata` object with an `openGraph` block mirroring its title/description (read the file first to reuse the exact strings). Pattern:
```ts
  openGraph: {
    title: /* existing title */,
    description: /* existing description */,
    type: "website",
  },
```

- [ ] **Step 3: Add openGraph to privacy**

Same as Step 2 for `apps/web/src/app/privacy/page.tsx`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web build`
Expected: build succeeds.

- [ ] **Step 5: Verify head tags**

`pnpm --filter web dev`; in Safari open `/`, `/brokers`, `/privacy`; View Source (or Web Inspector) and confirm one `<link rel="canonical">` on `/` and `og:title`/`og:description` present on all three.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/brokers/page.tsx apps/web/src/app/privacy/page.tsx
git commit -m "feat(seo): homepage canonical + OG, OG tags for brokers and privacy"
```

---

## Task 4: S1 — JSON-LD structured data

**Files:**
- Create: `apps/web/src/components/JsonLd.tsx` (typed `<script>` emitter)
- Modify: `apps/web/src/app/layout.tsx` (Organization, site-wide)
- Modify: `apps/web/src/app/glossary/page.tsx` (FAQPage from `TERMS`)
- Modify: `apps/web/src/app/meeting/[id]/page.tsx` (Article + BreadcrumbList)
- Modify: `apps/web/src/app/methodology/page.tsx` (Dataset)

**Constant:** site origin. Reuse `https://rateradar-web.vercel.app` as the canonical origin.

- [ ] **Step 1: Create the JsonLd component**

Create `apps/web/src/components/JsonLd.tsx`:
```tsx
import type { Thing, WithContext } from "schema-dts";

/**
 * Renders a JSON-LD <script>. Typed via schema-dts so the object shape is
 * checked at compile time (CLAUDE.md: no `any`). dangerouslySetInnerHTML is
 * the standard, safe way to emit JSON-LD in React — the payload is our own
 * server-built object, never user input.
 */
export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 2: Add schema-dts dev dependency**

Run: `pnpm --filter web add -D schema-dts`
Expected: added to `apps/web/package.json` devDependencies. (schema-dts is types-only, zero runtime weight.)
Then update the root lockfile so CI `--frozen-lockfile` passes:
Run: `pnpm install --lockfile-only`

- [ ] **Step 3: Organization schema site-wide**

In `apps/web/src/app/layout.tsx`, import the component and render it inside `<body>` (e.g. right after the opening `<body ...>` tag, before the funding-choices block):
```tsx
import { JsonLd } from "@/components/JsonLd";
```
```tsx
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "RateRadar",
            url: "https://rateradar-web.vercel.app",
            description:
              "Market-implied probabilities for Fed and ECB interest-rate decisions, with historical tracking.",
          }}
        />
```

- [ ] **Step 4: FAQPage schema on glossary**

In `apps/web/src/app/glossary/page.tsx`, import `JsonLd` and render it at the top of the returned `<main>`, built from `TERMS`:
```tsx
import { JsonLd } from "@/components/JsonLd";
```
```tsx
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: TERMS.map(({ term, def }) => ({
            "@type": "Question",
            name: term,
            acceptedAnswer: { "@type": "Answer", text: def },
          })),
        }}
      />
```

- [ ] **Step 5: Article + BreadcrumbList on meeting pages**

In `apps/web/src/app/meeting/[id]/page.tsx`, import `JsonLd` and render two scripts at the top of the returned `<main>` (inside the component, after `const bank = ...`). Use the existing `data`, `id`, `bank`, and `formatShortDate`:
```tsx
import { JsonLd } from "@/components/JsonLd";
```
```tsx
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${bank} ${formatShortDate(data.meeting.meeting_date)} rate decision · market-implied probabilities`,
          description: `Market-implied probabilities for the ${bank} ${formatShortDate(data.meeting.meeting_date)} rate decision, with 60 days of historical tracking.`,
          author: { "@type": "Organization", name: "RateRadar" },
          publisher: { "@type": "Organization", name: "RateRadar" },
          mainEntityOfPage: `https://rateradar-web.vercel.app/meeting/${id}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://rateradar-web.vercel.app/" },
            { "@type": "ListItem", position: 2, name: `${bank} ${formatShortDate(data.meeting.meeting_date)}`, item: `https://rateradar-web.vercel.app/meeting/${id}` },
          ],
        }}
      />
```

- [ ] **Step 6: Dataset schema on methodology**

Read `apps/web/src/app/methodology/page.tsx` first. Import `JsonLd` and render at the top of its `<main>`:
```tsx
import { JsonLd } from "@/components/JsonLd";
```
```tsx
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "RateRadar Fed & ECB rate-decision probability history",
          description:
            "Historical time series of market-implied probabilities for Federal Reserve and European Central Bank interest-rate decisions, computed in-house from public futures/OIS prices and snapshotted at least twice per business day.",
          creator: { "@type": "Organization", name: "RateRadar" },
          url: "https://rateradar-web.vercel.app/methodology",
          isAccessibleForFree: true,
        }}
      />
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web build`
Expected: build succeeds; schema-dts catches any malformed object at compile time.

- [ ] **Step 8: Verify JSON-LD present**

`pnpm --filter web dev`; in Safari View Source on `/`, `/glossary`, a meeting page, `/methodology`; confirm `<script type="application/ld+json">` blocks exist with valid JSON. Paste one into Google Rich Results Test (search.google.com/test/rich-results) for a structural sanity check if convenient.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/JsonLd.tsx apps/web/src/app/layout.tsx apps/web/src/app/glossary/page.tsx apps/web/src/app/meeting apps/web/src/app/methodology/page.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(seo): JSON-LD (Organization, FAQPage, Article+Breadcrumb, Dataset)"
```

---

## Task 5: S2 — Default OG image + social fallbacks

**Files:**
- Create: `apps/web/src/app/api/og/default/route.tsx` (mirror the existing meeting OG route)
- Modify: `apps/web/src/app/layout.tsx` (wire fallback `openGraph.images` + `twitter.images`)

- [ ] **Step 1: Inspect the existing OG route**

Read `apps/web/src/app/api/og/meeting/[id]/route.tsx` to copy its runtime export, `ImageResponse` import, size, and font/style approach.

- [ ] **Step 2: Create the default OG route**

Create `apps/web/src/app/api/og/default/route.tsx` mirroring the meeting route's structure but with static brand content (no params). Required shape:
```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge"; // match the meeting route's runtime

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#F5EFE3",
          color: "#1A1A1A",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.6 }}>RateRadar</div>
        <div style={{ fontSize: 72, fontWeight: 600, marginTop: 24, lineHeight: 1.1 }}>
          Fed + ECB rate-decision probabilities
        </div>
        <div style={{ fontSize: 34, opacity: 0.7, marginTop: 24 }}>
          See where rates are headed — before the meeting.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
```
> If the meeting route uses `runtime = "nodejs"` or a different export style, match that instead — keep the two routes consistent.

- [ ] **Step 3: Wire fallback images in layout metadata**

In `apps/web/src/app/layout.tsx`, extend the root `metadata.openGraph` and `metadata.twitter` to include the default image:
```ts
  openGraph: {
    title: "RateRadar",
    description:
      "Fed + ECB rate-decision probabilities with historical tracking. See where rates are headed before the meeting.",
    type: "website",
    images: ["/api/og/default"],
  },
  twitter: {
    card: "summary_large_image",
    title: "RateRadar",
    description: "Fed + ECB rate-decision probabilities with historical tracking.",
    images: ["/api/og/default"],
  },
```

- [ ] **Step 4: Typecheck + render**

Run: `pnpm --filter web build`
Expected: build succeeds.
Then `pnpm --filter web dev` and open http://localhost:3000/api/og/default in Safari — a 1200×630 branded image renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/og/default/route.tsx apps/web/src/app/layout.tsx
git commit -m "feat(seo): default OG image route + social image fallbacks"
```

---

## Task 6: S3 — Smart App Banner + apple-app-site-association

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (add itunes meta)
- Create: `apps/web/public/.well-known/apple-app-site-association`

- [ ] **Step 1: Get the iOS bundle id + team id**

Read `apps/ios-expo/app.json` → `expo.ios.bundleIdentifier`. The Apple App Store numeric id is `6768628917` (from README). The Team ID is `R95M36AU2X`. The AASA `appID` = `R95M36AU2X.<bundleIdentifier>`.

- [ ] **Step 2: Add the Smart App Banner meta**

In `apps/web/src/app/layout.tsx`, add to the root `metadata` object:
```ts
  itunes: { appId: "6768628917" },
```
> Next.js `Metadata.itunes.appId` emits `<meta name="apple-itunes-app" content="app-id=6768628917">`, which makes iOS Safari show the native install banner.

- [ ] **Step 3: Create the AASA file**

Create `apps/web/public/.well-known/apple-app-site-association` (no extension, valid JSON, replacing `<bundleId>` with the value from Step 1):
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "R95M36AU2X.<bundleId>",
        "paths": ["/meeting/*", "/compare", "/scenarios", "/glossary", "/brokers", "/"]
      }
    ]
  }
}
```
> Note: deep-linking only activates once the iOS app declares Associated Domains (Phase 3). Shipping the web file now is harmless and prerequisite.

- [ ] **Step 4: Typecheck + serve check**

Run: `pnpm --filter web build`
Then `pnpm --filter web dev`; in Safari open http://localhost:3000/.well-known/apple-app-site-association and confirm it serves the JSON. Confirm `<meta name="apple-itunes-app" ...>` appears in `/` source.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx "apps/web/public/.well-known/apple-app-site-association"
git commit -m "feat(aso): Smart App Banner meta + apple-app-site-association"
```

---

## Task 7: A1 — Expand AdSense surfaces + sticky-anchor unit

**Files:**
- Create: `apps/web/src/components/StickyAnchorAd.tsx`
- Modify: `apps/web/src/app/meeting/[id]/page.tsx`, `compare/page.tsx`, `scenarios/page.tsx`, `glossary/page.tsx` (one `<AdSlot>` each)
- Modify: `apps/web/src/app/layout.tsx` (render the sticky anchor once)

**Prerequisite — create AdSense units (manual, via Safari):** In the AdSense console (publisher `ca-pub-6563643868702361`), create 5 display units and record each numeric slot id:
- "RateRadar Meeting Detail" → `SLOT_MEETING`
- "RateRadar Compare" → `SLOT_COMPARE`
- "RateRadar Scenarios" → `SLOT_SCENARIOS`
- "RateRadar Glossary" → `SLOT_GLOSSARY`
- "RateRadar Sticky Anchor" → `SLOT_ANCHOR`

> Until real ids exist, the homepage already uses slot `4397253039`; do NOT reuse it across pages (per-placement reporting). If unit creation is blocked, pause this task and surface it — do not ship placeholder slot ids.

- [ ] **Step 1: In-content AdSlot on the four pages**

On each of the four pages, insert one ad section just before the closing `</main>` (and before the page footer where present), mirroring the homepage usage. Add the import `import { AdSlot } from "@/components/AdSlot";` to each page if absent.

`meeting/[id]/page.tsx` — after the Share `<section>` (line 187), before `<Rule />` (line 189):
```tsx
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot="SLOT_MEETING" format="auto" />
      </section>
```
`compare/page.tsx` — before the closing footer (line 150):
```tsx
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot="SLOT_COMPARE" format="auto" />
      </section>
```
`scenarios/page.tsx` — before `</main>` (line 44):
```tsx
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot="SLOT_SCENARIOS" format="auto" />
      </section>
```
`glossary/page.tsx` — before `</main>` (line 92):
```tsx
      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot="SLOT_GLOSSARY" format="auto" />
      </section>
```
Replace each `SLOT_*` literal with the real numeric id from the prerequisite.

- [ ] **Step 2: Create the sticky-anchor component**

Create `apps/web/src/components/StickyAnchorAd.tsx`. It reuses `AdSlot`, pins to the bottom, reserves height to avoid CLS, stays hidden inside the iOS WebView (AdSlot already returns null there), and is dismissible:
```tsx
"use client";

import { useState } from "react";
import { AdSlot } from "@/components/AdSlot";

const ANCHOR_SLOT = "SLOT_ANCHOR"; // replace with real AdSense unit id

export function StickyAnchorAd() {
  const [dismissed, setDismissed] = useState(false);
  const isNativeApp =
    typeof window !== "undefined" && window.NATIVE_PLATFORM === "ios";
  if (dismissed || isNativeApp) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-cream/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-5xl items-center justify-center px-2 py-1">
        <button
          type="button"
          aria-label="Dismiss ad"
          onClick={() => setDismissed(true)}
          className="absolute right-1 top-1 z-10 px-1.5 text-xs text-ink-mute hover:text-ink"
        >
          ✕
        </button>
        <div className="min-h-[50px] w-full">
          <AdSlot slot={ANCHOR_SLOT} format="horizontal" style={{ display: "block", minHeight: 50 }} />
        </div>
      </div>
    </div>
  );
}
```
> The `min-h-[50px]` / `minHeight: 50` reserve height so the anchor does not cause layout shift. The wrapper sits at z-40 (below modals) and does not obscure >30% of the viewport.

- [ ] **Step 3: Render the sticky anchor site-wide + pad body**

In `apps/web/src/app/layout.tsx`, import and render it at the end of `<body>` (after the `<div className="flex-1">{children}</div>`):
```tsx
import { StickyAnchorAd } from "@/components/StickyAnchorAd";
```
```tsx
        <div className="flex-1">{children}</div>
        <StickyAnchorAd />
```
Add bottom padding so the fixed anchor never covers page content — change the `<body>` className from `min-h-full bg-cream text-ink flex flex-col` to `min-h-full bg-cream text-ink flex flex-col pb-[60px]`.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm --filter web build` then `pnpm --filter web lint`
Expected: both clean.

- [ ] **Step 5: Visual + suppression check**

`pnpm --filter web dev` in Safari:
- On `/meeting/...`, `/compare`, `/scenarios`, `/glossary`: exactly one in-content ad slot renders (will show blank/placeholder locally without real fill — that's fine), no layout jumps, footer not overlapped by the anchor.
- Simulate the iOS WebView: in Safari Web Inspector console run `window.NATIVE_PLATFORM = 'ios'` then reload — confirm both the in-content slots and the sticky anchor disappear (no `<ins>` in DOM).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/StickyAnchorAd.tsx apps/web/src/app/layout.tsx apps/web/src/app/meeting apps/web/src/app/compare/page.tsx apps/web/src/app/scenarios/page.tsx apps/web/src/app/glossary/page.tsx
git commit -m "feat(ads): AdSense on meeting/compare/scenarios/glossary + sticky anchor (iOS-suppressed)"
```

---

## Task 8: Verification gate + PR

**Files:** none (verification + PR only)

- [ ] **Step 1: Full build + lint**

Run: `pnpm --filter web build && pnpm --filter web lint`
Expected: both green, no TS errors, no `any`.

- [ ] **Step 2: Lighthouse mobile (no regression)**

Run a production build locally (`pnpm --filter web build && pnpm --filter web start`), then Lighthouse (mobile) on `/` and one `/meeting/...` page. Confirm Perf ≥ 85, SEO ≥ 95, A11y ≥ 90. If the sticky anchor regresses Perf below 85 or causes CLS, gate it behind a flag or remove it and note that in the PR.

- [ ] **Step 3: Safari visual pass (the DoD checklist)**

Confirm on the live dev server: B1 countdown stable, B2 chart legend matches lines, JSON-LD present on `/` `/glossary` `/methodology` + a meeting page, default OG image renders, `apple-itunes-app` meta present, AASA serves JSON, one ad per page, and all ads + anchor vanish when `window.NATIVE_PLATFORM='ios'`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/web-growth-revenue
gh pr create --base main --head feat/web-growth-revenue \
  --title "feat(web): Phase 1 growth & ad-revenue — bug fixes, SEO/ASO, ad surfaces" \
  --body "Implements docs/superpowers/specs/2026-06-01-rateradar-growth-revenue-design.md (Phase 1). Web-only; deploys instantly via Vercel; iOS WebView unaffected (AdSense stays suppressed in-app). Does not touch the in-review native v1.0.2."
```
Expected: CI green (it runs `--frozen-lockfile`; the lockfile was updated in Task 4 Step 2).

- [ ] **Step 5: Verify Vercel preview**

Open the Vercel preview URL from the PR in Safari; spot-check `/` and a meeting page render correctly and structured data is present.

---

## Self-review (done against the spec)

- **Spec coverage:** B1✓(T1) B2✓(T2) B3/B4 dropped-by-design✓ S1✓(T4) S2✓(T5) S3✓(T6) S4✓(T3) A1✓(T7) verification gate✓(T8). PostHog explicitly out of scope. Native = Phase 3, not in this plan.
- **Placeholders:** `SLOT_*` and `<bundleId>` are intentional, clearly-flagged externally-sourced values (AdSense console / app.json), each with an explicit "replace with real id / pause if blocked" instruction — not lazy TODOs.
- **Type consistency:** `JsonLd<T>` defined in T4 Step 1 and used with `WithContext<T>` objects in T4 Steps 3-6; `AdSlot` props (`slot`, `format`, `style`) match the existing component signature; `StickyAnchorAd` defined in T7 Step 2 and consumed in T7 Step 3.
- **No test runner:** verification is build + lint + Safari + Lighthouse throughout, consistent with project reality.
