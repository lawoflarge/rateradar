# RateRadar Phase 1 — Web Wire Room Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark/emerald RateRadar web design with the "Wire Room" editorial light theme (paper-cream + ink + amber/crimson accents, Inter + JetBrains Mono + IBM Plex Serif) across every page and component, then deploy to Vercel preview for Levin's eyeball check.

**Architecture:** All changes scoped to `apps/web/`. CSS tokens defined in `globals.css` via Tailwind 4 `@theme inline`. Fonts loaded via `next/font/google` in `layout.tsx`. Components and pages refactored to use semantic Tailwind utilities (`bg-cream`, `text-ink`, `text-cut-accent`, `font-mono`, etc.). No new dependencies. No layout structure changes — only typography, color, and spacing/rule details.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, `next/font/google`, existing Supabase + ISR setup unchanged.

**Branch:** `ios-launch-v1` (already created)

**Spec:** `docs/superpowers/specs/2026-05-12-rateradar-ios-app-store-launch-design.md` §2 (Wire Room), §5.1 (web)

---

## File Structure

### Files modified
- `apps/web/src/app/globals.css` — CSS variables + Tailwind 4 `@theme inline` block
- `apps/web/src/app/layout.tsx` — font imports + body classes
- `apps/web/src/components/NavBar.tsx` — light theme + hairline border
- `apps/web/src/components/MostLikelyPath.tsx` — color swap + table style
- `apps/web/src/components/ProbabilityTable.tsx` — color swap + rule borders
- `apps/web/src/components/HistoricalChart.tsx` — chart line/grid colors
- `apps/web/src/components/ImpliedRateCurve.tsx` — chart colors
- `apps/web/src/components/MeetingContext.tsx` — card → rule-separated rows
- `apps/web/src/components/MeetingCountdown.tsx` — mono numerals
- `apps/web/src/components/ShareButtons.tsx` — link colors
- `apps/web/src/app/page.tsx` — hero, sections, layout polish
- `apps/web/src/app/meeting/[id]/page.tsx` — hero, sections
- `apps/web/src/app/compare/page.tsx` — split-screen layout
- `apps/web/src/app/methodology/page.tsx` — typographic content
- `apps/web/src/app/glossary/page.tsx` — definition list style
- `apps/web/src/app/brokers/page.tsx` — content layout
- `apps/web/src/app/about/page.tsx` — content layout
- `apps/web/src/app/error.tsx`, `loading.tsx`, `not-found.tsx` — color swap
- `apps/web/src/app/api/[bank]/og/route.tsx` — light theme OG
- `apps/web/src/app/api/meetings/[id]/og/route.tsx` — light theme OG

### Files created
- `apps/web/src/components/BrandMark.tsx` — radar+sparkline mark (replaces inline glow circle)
- `apps/web/src/components/Rule.tsx` — semantic `<hr>` with consistent styling
- `apps/web/src/components/SectionLabel.tsx` — small-caps section header

### Files unchanged
- All `lib/` files, `data.ts`, `types.ts`, API routes (other than OG)
- `package.json` (no new deps; Tailwind 4 + next/font/google already present)
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`

---

## Task 1: Define Wire Room CSS tokens

**Files:**
- Modify: `apps/web/src/app/globals.css` (entire file)

- [ ] **Step 1: Replace globals.css with Wire Room tokens**

Replace the entire contents of `apps/web/src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  /* Wire Room palette */
  --color-cream: #F5F1E8;
  --color-cream-soft: #EFEADD;
  --color-ink: #0E0E0E;
  --color-ink-soft: #2B2B2B;
  --color-ink-mute: #6F6A60;
  --color-rule: #1A1A1A;
  --color-rule-soft: #C9C2B0;
  --color-cut: #C8841C;
  --color-cut-soft: #E9C281;
  --color-hike: #A8312A;
  --color-hike-soft: #D88983;
  --color-hold: #3E5640;
}

@theme inline {
  --color-background: var(--color-cream);
  --color-foreground: var(--color-ink);

  --color-cream: var(--color-cream);
  --color-cream-soft: var(--color-cream-soft);
  --color-ink: var(--color-ink);
  --color-ink-soft: var(--color-ink-soft);
  --color-ink-mute: var(--color-ink-mute);
  --color-rule: var(--color-rule);
  --color-rule-soft: var(--color-rule-soft);
  --color-cut: var(--color-cut);
  --color-cut-soft: var(--color-cut-soft);
  --color-hike: var(--color-hike);
  --color-hike-soft: var(--color-hike-soft);
  --color-hold: var(--color-hold);

  --font-sans: var(--font-inter);
  --font-serif: var(--font-plex-serif);
  --font-mono: var(--font-jetbrains);
}

body {
  background: var(--color-cream);
  color: var(--color-ink);
  font-family: var(--font-inter), system-ui, sans-serif;
  font-feature-settings: "ss01", "cv11";
}

/* Tabular numerals everywhere mono is used */
.font-mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "zero", "ss02";
}

/* Small caps section labels */
.small-caps {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.12em;
  text-transform: lowercase;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): Wire Room design tokens + Tailwind 4 theme block"
```

---

## Task 2: Swap fonts in layout.tsx

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (replace imports + html element)

- [ ] **Step 1: Update layout.tsx with new fonts and body classes**

Replace the entire contents of `apps/web/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RateRadar — Fed + ECB rate-decision probabilities",
    template: "%s · RateRadar",
  },
  description:
    "Track market-implied probabilities for Fed and ECB interest-rate decisions, with historical charts showing how expectations have shifted over days and weeks.",
  openGraph: {
    title: "RateRadar",
    description:
      "Fed + ECB rate-decision probabilities with historical tracking. See where rates are headed — before the meeting.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RateRadar",
    description: "Fed + ECB rate-decision probabilities with historical tracking.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${plexSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream text-ink flex flex-col">
        <NavBar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run dev server and confirm fonts load**

```bash
cd apps/web && pnpm dev
```

Visit `http://localhost:3000/` — fonts should now be Inter/JetBrains Mono/IBM Plex Serif rather than Geist. Page will look broken (dark utilities + light bg) — that's expected, fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): swap Geist for Inter + JetBrains Mono + IBM Plex Serif"
```

---

## Task 3: Create BrandMark component

**Files:**
- Create: `apps/web/src/components/BrandMark.tsx`

- [ ] **Step 1: Write BrandMark.tsx**

Create `apps/web/src/components/BrandMark.tsx`:

```tsx
type Size = "sm" | "md";

export function BrandMark({ size = "md" }: { size?: Size }) {
  const px = size === "sm" ? 20 : 36;
  return (
    <svg
      role="img"
      aria-label="RateRadar"
      width={px}
      height={px}
      viewBox="0 0 36 36"
      className="text-ink"
    >
      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="18" cy="18" r="4" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <path
        d="M18 18 L31 12"
        stroke="var(--color-cut)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="31" cy="12" r="1.6" fill="var(--color-cut)" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/BrandMark.tsx
git commit -m "feat(web): BrandMark radar+sparkline component"
```

---

## Task 4: Create SectionLabel and Rule components

**Files:**
- Create: `apps/web/src/components/SectionLabel.tsx`
- Create: `apps/web/src/components/Rule.tsx`

- [ ] **Step 1: Write SectionLabel.tsx**

Create `apps/web/src/components/SectionLabel.tsx`:

```tsx
import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="small-caps text-xs font-medium text-ink-mute">{children}</div>
  );
}
```

- [ ] **Step 2: Write Rule.tsx**

Create `apps/web/src/components/Rule.tsx`:

```tsx
export function Rule({ tone = "ink" }: { tone?: "ink" | "soft" }) {
  return (
    <hr
      aria-hidden
      className={tone === "ink" ? "border-t border-ink/80" : "border-t border-rule-soft"}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SectionLabel.tsx apps/web/src/components/Rule.tsx
git commit -m "feat(web): SectionLabel + Rule shared components"
```

---

## Task 5: Refactor NavBar to Wire Room

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx` (replace entire file)

- [ ] **Step 1: Replace NavBar.tsx**

Replace the entire contents of `apps/web/src/components/NavBar.tsx` with:

```tsx
import Link from "next/link";
import { BrandMark } from "./BrandMark";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/compare", label: "Fed vs ECB" },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
  { href: "/brokers", label: "Brokers" },
  { href: "/about", label: "About" },
];

export function NavBar() {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink/15 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold tracking-tight text-ink">RateRadar</span>
        </Link>
        <div className="flex flex-wrap items-center gap-5 text-sm text-ink-soft">
          {LINKS.filter((l) => l.href !== "/").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-cut transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Visual check**

Reload `http://localhost:3000/`. Nav should now be light cream + ink + amber hover. Body still has dark utilities → page mostly unstyled.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/NavBar.tsx
git commit -m "feat(web): Wire Room NavBar with BrandMark"
```

---

## Task 6: Refactor homepage hero + main sections

**Files:**
- Modify: `apps/web/src/app/page.tsx` (entire file)

- [ ] **Step 1: Replace page.tsx**

Open `apps/web/src/app/page.tsx`. Replace the entire return JSX block (everything inside `return (...)`) and the inline `header` icon to use Wire Room utilities. The full replacement:

```tsx
import { ImpliedRateCurve } from "@/components/ImpliedRateCurve";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { MostLikelyPath } from "@/components/MostLikelyPath";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import {
  getEcbProbabilities,
  getFedProbabilities,
  getMeetingHistory,
} from "@/lib/data";
import { CURRENT_POLICY_RATES } from "@/lib/policy-rates";
import type { MeetingProbabilities, ProbabilitySeries } from "@/lib/types";

export const revalidate = 300;

async function prefetchHistory(
  snapshots: MeetingProbabilities[],
  count: number,
): Promise<Record<string, ProbabilitySeries[]>> {
  const out: Record<string, ProbabilitySeries[]> = {};
  for (const s of snapshots.slice(0, count)) {
    out[s.meeting.id] = await getMeetingHistory(s.meeting.id, 60);
  }
  return out;
}

function soonestMeeting(
  fed: MeetingProbabilities[],
  ecb: MeetingProbabilities[],
): MeetingProbabilities | null {
  const all = [...fed, ...ecb];
  if (all.length === 0) return null;
  return all.reduce((earliest, cur) =>
    cur.meeting.meeting_date < earliest.meeting.meeting_date ? cur : earliest,
  );
}

export default async function Home() {
  const [fed, ecb] = await Promise.all([
    getFedProbabilities(),
    getEcbProbabilities(),
  ]);

  const [fedHistory, ecbHistory] = await Promise.all([
    prefetchHistory(fed, 3),
    prefetchHistory(ecb, 3),
  ]);

  const next = soonestMeeting(fed, ecb);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16">
        <SectionLabel>Real-time market-implied odds</SectionLabel>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          See where rates are headed
          <span className="block text-ink-mute">— before the meeting.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Market-implied probabilities for Fed and ECB interest-rate decisions, with
          historical tracking over days and weeks. Computed from Fed Funds Futures and
          €STR OIS — not scraped.
        </p>
      </header>

      <Rule />

      {next && (
        <section className="my-12">
          <SectionLabel>Next decision</SectionLabel>
          <div className="mt-4 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="text-sm uppercase tracking-wider text-cut">
                {next.meeting.bank} · {new Date(next.meeting.meeting_date).toLocaleDateString("en-US", { dateStyle: "long" })}
              </div>
              <h2 className="mt-2 font-serif text-3xl font-medium leading-tight">
                {next.most_likely_decision.label}
              </h2>
              <p className="mt-2 text-ink-soft">
                Current policy rate {CURRENT_POLICY_RATES[next.meeting.bank]}%.
                Market puts <span className="font-mono font-semibold text-ink">{(next.most_likely_decision.probability * 100).toFixed(0)}%</span> on this outcome.
              </p>
            </div>
            <MeetingCountdown date={next.meeting.meeting_date} />
          </div>
        </section>
      )}

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Most likely path · cumulative</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {fed.length > 0 && <MostLikelyPath snapshots={fed} bank="Fed" />}
          {ecb.length > 0 && <MostLikelyPath snapshots={ecb} bank="ECB" />}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Implied rate curves</SectionLabel>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {fed.length > 0 && <ImpliedRateCurve snapshots={fed} bank="Fed" />}
          {ecb.length > 0 && <ImpliedRateCurve snapshots={ecb} bank="ECB" />}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Per-meeting probabilities · Fed</SectionLabel>
        <div className="mt-6 space-y-12">
          {fed.slice(0, 3).map((s) => (
            <ProbabilityTable key={s.meeting.id} snapshot={s} history={fedHistory[s.meeting.id] ?? []} />
          ))}
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>Per-meeting probabilities · ECB</SectionLabel>
        <div className="mt-6 space-y-12">
          {ecb.slice(0, 3).map((s) => (
            <ProbabilityTable key={s.meeting.id} snapshot={s} history={ecbHistory[s.meeting.id] ?? []} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run build and verify**

```bash
cd apps/web && pnpm build
```

Expected: build succeeds (the inner components still use old dark utilities, but that's lint-clean — colors are just wrong visually).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): Wire Room homepage layout + SectionLabel + Rule"
```

---

## Task 7: Refactor MostLikelyPath component

**Files:**
- Modify: `apps/web/src/components/MostLikelyPath.tsx`

- [ ] **Step 1: Read current file**

```bash
cat apps/web/src/components/MostLikelyPath.tsx
```

- [ ] **Step 2: Find-and-replace color classes**

Apply these literal substitutions in `apps/web/src/components/MostLikelyPath.tsx`:
- `text-zinc-100` → `text-ink`
- `text-zinc-200` → `text-ink`
- `text-zinc-300` → `text-ink-soft`
- `text-zinc-400` → `text-ink-mute`
- `text-zinc-500` → `text-ink-mute`
- `text-emerald-400` → `text-cut`
- `text-emerald-300` → `text-cut`
- `bg-zinc-950` → `bg-cream`
- `bg-zinc-900/50` → `bg-cream-soft`
- `bg-zinc-900` → `bg-cream-soft`
- `border-zinc-800` → `border-ink/15`
- `border-zinc-700` → `border-ink/25`
- `rounded-2xl` → `rounded-none`
- `rounded-xl` → `rounded-none`
- Add `font-mono tabular-nums` to all span/div displaying probabilities or rates
- Remove any `bg-gradient-to-*` lines (replace with plain `bg-cream-soft`)

- [ ] **Step 3: Visual check**

```bash
cd apps/web && pnpm dev
```

Open `/`. The MostLikelyPath cards should now read on cream background with ink text and amber accents.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MostLikelyPath.tsx
git commit -m "feat(web): Wire Room MostLikelyPath"
```

---

## Task 8: Refactor ProbabilityTable

**Files:**
- Modify: `apps/web/src/components/ProbabilityTable.tsx`

- [ ] **Step 1: Apply find-and-replace from Task 7**

Apply the same color substitutions in `apps/web/src/components/ProbabilityTable.tsx`. Additionally:
- Probability values: wrap in `<span className="font-mono tabular-nums font-medium">{value}</span>`
- Table rows: use `border-b border-ink/10 last:border-b-0` instead of bg striping
- For the "rate cut" rows (where action.label includes "cut"): tone with `text-cut`
- For the "rate hike" rows: tone with `text-hike`
- For "hold": tone with `text-hold`

- [ ] **Step 2: Visual check**

Reload `/`. Probability table rows should be ruled, ink text, amber/crimson/green tones per action.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ProbabilityTable.tsx
git commit -m "feat(web): Wire Room ProbabilityTable with rate-action tones"
```

---

## Task 9: Refactor HistoricalChart

**Files:**
- Modify: `apps/web/src/components/HistoricalChart.tsx`

- [ ] **Step 1: Find-and-replace + chart color updates**

Apply the same color substitutions. Additionally, find SVG `stroke=` and `fill=` attributes:
- Stroke `#34d399` (emerald) or `text-emerald-*` paths → `var(--color-cut)` / `#C8841C`
- Grid lines: `stroke="#27272a"` (zinc-800) → `stroke="#1A1A1A"` opacity 0.12
- Axis labels: text-zinc-400 → `text-ink-mute font-mono tabular-nums text-xs`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/HistoricalChart.tsx
git commit -m "feat(web): Wire Room HistoricalChart"
```

---

## Task 10: Refactor ImpliedRateCurve

**Files:**
- Modify: `apps/web/src/components/ImpliedRateCurve.tsx`

- [ ] **Step 1: Apply same color + chart updates as HistoricalChart**

Apply find-and-replace from Task 7. Update SVG stroke/fill as in Task 9. Use `--color-cut` for the curve.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ImpliedRateCurve.tsx
git commit -m "feat(web): Wire Room ImpliedRateCurve"
```

---

## Task 11: Refactor MeetingContext + MeetingCountdown + ShareButtons

**Files:**
- Modify: `apps/web/src/components/MeetingContext.tsx`
- Modify: `apps/web/src/components/MeetingCountdown.tsx`
- Modify: `apps/web/src/components/ShareButtons.tsx`

- [ ] **Step 1: Apply color substitutions to all three**

Use the find-and-replace list from Task 7 across all three files. Additionally for MeetingCountdown, wrap the countdown digits in `<span className="font-mono tabular-nums">`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/MeetingContext.tsx apps/web/src/components/MeetingCountdown.tsx apps/web/src/components/ShareButtons.tsx
git commit -m "feat(web): Wire Room MeetingContext + Countdown + ShareButtons"
```

---

## Task 12: Refactor /meeting/[id] page

**Files:**
- Modify: `apps/web/src/app/meeting/[id]/page.tsx`

- [ ] **Step 1: Apply color substitutions**

Apply find-and-replace from Task 7 across the entire file. Wrap any standalone probability or rate values in `<span className="font-mono tabular-nums">`. Replace `rounded-2xl` cards with `border-y border-ink/15 py-8` rule-separated sections.

- [ ] **Step 2: Add SectionLabel + Rule imports and use them for each major section**

Where the file previously had headings like `<h2 className="text-xl ...">Path Context</h2>`, insert `<SectionLabel>Path context</SectionLabel>` above an h2 that uses `font-serif text-3xl font-medium`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/meeting/[id]/page.tsx
git commit -m "feat(web): Wire Room meeting detail page"
```

---

## Task 13: Refactor /compare page

**Files:**
- Modify: `apps/web/src/app/compare/page.tsx`

- [ ] **Step 1: Apply color substitutions and typographic upgrades**

Apply find-and-replace from Task 7. For the side-by-side Fed vs ECB layout, separate columns with `border-l border-ink/15` instead of card backgrounds. Use `<SectionLabel>` above each column header. Add `font-serif` to h2 elements. Wrap all numerals in `font-mono tabular-nums`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/compare/page.tsx
git commit -m "feat(web): Wire Room compare page"
```

---

## Task 14: Refactor content pages (methodology, glossary, brokers, about)

**Files:**
- Modify: `apps/web/src/app/methodology/page.tsx`
- Modify: `apps/web/src/app/glossary/page.tsx`
- Modify: `apps/web/src/app/brokers/page.tsx`
- Modify: `apps/web/src/app/about/page.tsx`

- [ ] **Step 1: Apply substitutions and typography to all four**

In each file:
- Apply color find-and-replace from Task 7
- Wrap the page in `<main className="mx-auto max-w-3xl px-6 py-16">` (narrower max-width for prose pages)
- Use `font-serif text-5xl font-medium tracking-tight` for the H1, `font-serif text-2xl font-medium` for H2
- Body prose: `text-lg leading-relaxed text-ink-soft` and add `prose prose-ink` semantic helper if a long-form section
- Glossary: use `<dl>` definition list with `<dt className="font-mono uppercase text-sm text-ink">term</dt>` and `<dd className="mt-1 text-ink-soft">definition</dd>` separated by `<Rule tone="soft" />`
- Brokers: cards become rule-separated rows with broker name in serif, value props as bullet list

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/methodology/page.tsx apps/web/src/app/glossary/page.tsx apps/web/src/app/brokers/page.tsx apps/web/src/app/about/page.tsx
git commit -m "feat(web): Wire Room content pages"
```

---

## Task 15: Refactor error.tsx, loading.tsx, not-found.tsx

**Files:**
- Modify: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/loading.tsx`
- Modify: `apps/web/src/app/not-found.tsx`

- [ ] **Step 1: Apply substitutions and add BrandMark**

Apply color find-and-replace from Task 7. In `not-found.tsx`, replace any logo glow circle with `<BrandMark />`. Use `font-serif text-4xl` for the heading.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/error.tsx apps/web/src/app/loading.tsx apps/web/src/app/not-found.tsx
git commit -m "feat(web): Wire Room error/loading/not-found pages"
```

---

## Task 16: Refactor OG image generators

**Files:**
- Modify: `apps/web/src/app/api/[bank]/og/route.tsx` (if exists, else skip)
- Modify: `apps/web/src/app/api/meetings/[id]/og/route.tsx`

- [ ] **Step 1: Inspect OG route**

```bash
ls apps/web/src/app/api/ 2>&1
cat apps/web/src/app/api/meetings/[id]/og/route.tsx 2>&1 | head -80
```

- [ ] **Step 2: Update OG colors and fonts**

In the OG route file, replace any inline color values:
- `#0a0a0a` / `bg-zinc-950` → `#F5F1E8` (cream)
- `#fafafa` / `text-zinc-100` → `#0E0E0E` (ink)
- `#34d399` (emerald) → `#C8841C` (cut amber)
- Use `JetBrainsMono` and `IBMPlexSerif` fonts loaded inline via `fetch(...)` from Google Fonts CDN

If the OG route uses `next/og`'s `ImageResponse`, font loading pattern:

```ts
const inter = await fetch(
  new URL("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff2"),
).then((r) => r.arrayBuffer());
```

Pass to `ImageResponse(..., { fonts: [{ name: "Inter", data: inter, style: "normal" }, ...] })`.

- [ ] **Step 3: Test OG locally**

```bash
curl http://localhost:3000/api/meetings/<any-id>/og -o /tmp/og.png
```

Open the PNG, confirm it's cream background with ink + amber.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/
git commit -m "feat(web): Wire Room OG image generators"
```

---

## Task 17: Build + lint + Lighthouse pass

- [ ] **Step 1: Run full build**

```bash
cd apps/web && pnpm build
```

Expected: success, no type errors, no lint errors.

- [ ] **Step 2: Run lint explicitly**

```bash
cd apps/web && pnpm lint
```

Expected: clean.

- [ ] **Step 3: Start production build locally and Lighthouse**

```bash
cd apps/web && pnpm start &
```

Wait for "Ready on port 3000", then in another shell:

```bash
# If lighthouse-cli is installed globally
lighthouse http://localhost:3000/ --quiet --chrome-flags="--headless" --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo
```

Expected: all four scores ≥ 90.

If lighthouse-cli is not installed, defer this step and run via Vercel preview later.

- [ ] **Step 4: Stop server**

```bash
# kill the pnpm start process
```

---

## Task 18: Visual QA via agent-browser screenshots

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 2: Capture screenshots of each page**

Use the agent-browser skill or the browse tool to take screenshots of:
- `http://localhost:3000/`
- `http://localhost:3000/meeting/<one-known-id>` (pick from `/api/[bank]/probabilities`)
- `http://localhost:3000/compare`
- `http://localhost:3000/methodology`
- `http://localhost:3000/glossary`
- `http://localhost:3000/brokers`
- `http://localhost:3000/about`
- Mobile viewport (375×812) for each above

Save to `apps/web/archive/screenshots/wire-room-2026-05-12/`.

- [ ] **Step 3: Visual inspection**

Open each screenshot. Confirm:
- Cream background throughout
- IBM Plex Serif on H1/H2 headlines, JetBrains Mono on all numerals
- Amber accents on call-to-action / cut indicators
- Crimson on hike indicators
- Hairline rules between sections
- No dark cards, no gradients, no glows
- Tables and charts are legible (no contrast issues)

- [ ] **Step 4: Stop server**

---

## Task 19: Push and request Vercel preview

- [ ] **Step 1: Push branch**

```bash
cd C:\Users\levin\rateradar
git push -u origin ios-launch-v1
```

- [ ] **Step 2: Wait for Vercel preview deploy**

Vercel auto-deploys preview from any push. URL pattern: `rateradar-web-git-ios-launch-v1-lawoflarges-projects.vercel.app`.

```bash
sleep 90
```

(or check via `vercel ls` if CLI is set up)

- [ ] **Step 3: Sanity-check preview URL**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://rateradar-web-git-ios-launch-v1-lawoflarges-projects.vercel.app/
```

Expected: 200.

- [ ] **Step 4: Lighthouse against preview (if local was skipped)**

```bash
lighthouse https://rateradar-web-git-ios-launch-v1-lawoflarges-projects.vercel.app/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --quiet
```

Expected: all four ≥ 90.

---

## Task 20: Checkpoint — Levin review

- [ ] **Step 1: Announce preview URL to Levin**

Surface the Vercel preview URL in chat with a one-line summary: "Web Wire Room refresh deployed to preview at <URL>. Eyeball it; thumbs-up moves to Phase 2 (iOS scaffold)."

- [ ] **Step 2: Wait for Levin's response**

If approved: proceed to write Plan 2 (Phase 2-3 iOS app) and execute.
If changes requested: apply, push, repeat Step 1.

- [ ] **Step 3: Merge to main (after approval)**

```bash
git checkout main
git merge ios-launch-v1 --no-ff -m "feat(web): Wire Room design refresh"
git push origin main
git checkout ios-launch-v1
```

Vercel will deploy main to production at `rateradar-web.vercel.app`. The iOS WebView will pick up the new design automatically since it loads the live URL.

---

## Self-review notes

**Spec coverage:** Every section of §2 (Wire Room palette + typography) is covered by Tasks 1-2. Every page mentioned in §5.1 is covered by Tasks 6, 12-15. OG regeneration covered by Task 16. Lighthouse budget covered by Task 17.

**Placeholder scan:** None — all CSS values, color tokens, font names, file paths, and commands are concrete.

**Type consistency:** No new TypeScript types introduced; existing `MeetingProbabilities`, `ProbabilitySeries` from `lib/types.ts` are reused unchanged. Component props for `SectionLabel`, `Rule`, `BrandMark` are simple and self-consistent across tasks.

**Risk note for executor:** Tasks 7-15 rely on `cat` + Edit-tool pattern rather than full-file rewrites because component internals beyond color/font are intentionally preserved. If a substitution misses a class (e.g., a Tailwind variant like `hover:text-emerald-400`), the executor must include those variants in the find-and-replace pass.

---

**End of Plan 1.** Plan 2 (Phase 2-3 iOS app) will be written after Phase 1 ships.
