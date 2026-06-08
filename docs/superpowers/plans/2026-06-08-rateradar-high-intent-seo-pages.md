# RateRadar High-Intent SEO Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture high-intent search demand around Fed/ECB decisions by building always-fresh `/fed` + `/ecb` "next meeting" hubs and reframing the meeting detail pages as question pages with FAQ schema — feeding the existing AdSense surfaces, web-only, no App Store dependency.

**Architecture:** Two new Next.js App-Router Server Components (`/fed`, `/ecb`) reuse the existing `getFedProbabilities()`/`getEcbProbabilities()` data layer (already returns future scheduled meetings, sorted ascending) via a new pure `pickNextMeeting()` helper. The meeting detail page gets surgical metadata/JSON-LD edits. Discoverability via NavBar + sitemap. All pages use ISR (`revalidate = 300`) so the existing pipeline cron keeps them fresh.

**Tech Stack:** Next.js 15 App Router (RSC), TypeScript strict (no `any`), `schema-dts`-typed JSON-LD, Tailwind, pnpm workspace (`apps/web`).

---

## Important context (read before starting)

- **NO unit-test runner exists in `apps/web`.** Per the spec, verification is
  `pnpm --filter web build` (compiles + type-checks every route → catches `any`,
  bad `schema-dts` shapes, missing imports) + `pnpm --filter web lint` + a visual
  Playwright pass + a JSON-LD grep. Do NOT add a test runner (out of scope, YAGNI).
- **The data layer already does the hard part:** `getProbabilities(bank)` returns
  only future `scheduled` meetings, sorted ascending by date. `pickNextMeeting`
  exists only to stay robust against the unsorted JSON-fallback path.
- **ECB is spot-anchored** (no real forward odds — paid data unavailable). The
  `/ecb` hub MUST stay honest: show the date + current Deposit Facility Rate
  (2.00%) + an explicit "forward odds unavailable" note. NEVER fabricate ECB cut
  probabilities. (FED has real futures-implied odds.)
- **Honor `apps/web` + repo `CLAUDE.md`:** strict TS no `any`; don't regress
  Lighthouse SEO ≥ 95; retail-first tone; conventional commits (`feat:`/`fix:`).
- **Branch `feat/high-intent-seo-pages` is active; spec committed as `f614cb4`.**
- Run all commands from the repo root `~/Data/Claude/rateradar` unless noted.

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/data.ts` | Modify | Add pure `pickNextMeeting(meetings)` helper |
| `apps/web/src/lib/ad-slots.ts` | Modify | Add env-driven `fed` + `ecb` slots |
| `apps/web/src/app/fed/page.tsx` | Create | FOMC hub: next meeting + odds + schedule + FAQ |
| `apps/web/src/app/ecb/page.tsx` | Create | ECB hub: next meeting + current rate + schedule + FAQ (odds-free) |
| `apps/web/src/app/meeting/[id]/page.tsx` | Modify | Question-framed metadata + FAQ JSON-LD + `<h2>` |
| `apps/web/src/components/NavBar.tsx` | Modify | Add Fed + ECB nav links |
| `apps/web/src/app/sitemap.ts` | Modify | Add `/fed` + `/ecb` |
| Google Search Console (dashboard) | Config | Verify domain + submit sitemap (non-blocking, no code) |

---

### Task 1: `pickNextMeeting` pure helper

**Files:**
- Modify: `apps/web/src/lib/data.ts` (add export after `getEcbProbabilities`, ~line 153)

- [ ] **Step 1: Add the helper**

Insert immediately after the `getEcbProbabilities` export (the `/** ECB counterpart. */` block):

```ts
/**
 * From a set of meeting snapshots, pick the soonest upcoming one (meeting_date
 * today or later), or null if none are upcoming. `getProbabilities` already
 * returns only future scheduled meetings sorted ascending, but this stays
 * robust against the JSON-fallback path, which may be unsorted.
 */
export function pickNextMeeting(
  meetings: MeetingProbabilities[],
): MeetingProbabilities | null {
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = meetings
    .filter((m) => m.meeting.meeting_date >= todayISO)
    .sort((a, b) => (a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1));
  return upcoming[0] ?? null;
}
```

`MeetingProbabilities` is already imported at the top of the file — no new import.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter web build`
Expected: build succeeds (compiles). If it fails, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/data.ts
git commit -m "feat(web): add pickNextMeeting helper for hub pages"
```

---

### Task 2: Add `fed` + `ecb` AdSense slots

**Files:**
- Modify: `apps/web/src/lib/ad-slots.ts`

- [ ] **Step 1: Extend AD_SLOTS**

Replace the `AD_SLOTS` object body so it ends with the two new slots (keep all existing entries unchanged):

```ts
export const AD_SLOTS = {
  home: "4397253039",
  meeting: process.env.NEXT_PUBLIC_AD_SLOT_MEETING ?? "",
  compare: process.env.NEXT_PUBLIC_AD_SLOT_COMPARE ?? "",
  scenarios: process.env.NEXT_PUBLIC_AD_SLOT_SCENARIOS ?? "",
  glossary: process.env.NEXT_PUBLIC_AD_SLOT_GLOSSARY ?? "",
  anchor: process.env.NEXT_PUBLIC_AD_SLOT_ANCHOR ?? "",
  fed: process.env.NEXT_PUBLIC_AD_SLOT_FED ?? "",
  ecb: process.env.NEXT_PUBLIC_AD_SLOT_ECB ?? "",
} as const;
```

Empty default = `AdSlot` renders `null` (no empty `<ins>`), so the placements are inert until the real AdSense units + Vercel env vars exist. No code change needed to light them up later.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ad-slots.ts
git commit -m "feat(web): add fed + ecb ad slots (env-driven, inert until set)"
```

---

### Task 3: `/fed` FOMC hub page

**Files:**
- Create: `apps/web/src/app/fed/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { ProbabilityTable } from "@/components/ProbabilityTable";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { getFedProbabilities, pickNextMeeting } from "@/lib/data";
import type { MeetingProbabilities } from "@/lib/types";

export const revalidate = 300;

const BASE_URL = "https://rateradar-web.vercel.app";

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function topOutcome(m: MeetingProbabilities) {
  return [...m.outcomes].sort((a, b) => b.probability - a.probability)[0];
}

function summarize(next: MeetingProbabilities | null): string {
  if (!next) return "The next FOMC meeting date will appear here once scheduled.";
  const top = topOutcome(next);
  const pct = Math.round(top.probability * 100);
  const action = top.label === "Hold" ? "hold rates" : `move ${top.label}`;
  return `Markets price a ${pct}% chance the Fed will ${action} at the ${formatShortDate(next.meeting.meeting_date)} meeting.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const next = pickNextMeeting(await getFedProbabilities());
  const title = next
    ? `Next Fed Meeting: ${formatShortDate(next.meeting.meeting_date)} — rate-cut odds`
    : "Next Fed Meeting — FOMC schedule & rate-cut odds";
  const description = next
    ? `${summarize(next)} Live FOMC probabilities and the full meeting schedule.`
    : "Live market-implied probabilities for the next FOMC decision and the full Fed meeting schedule.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/api/og/default"] },
    alternates: { canonical: "/fed" },
  };
}

export default async function FedHubPage() {
  const meetings = await getFedProbabilities();
  const next = pickNextMeeting(meetings);
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = [...meetings]
    .filter((m) => m.meeting.meeting_date >= todayISO)
    .sort((a, b) => (a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1));
  const year = next
    ? new Date(next.meeting.meeting_date).getFullYear()
    : new Date().getFullYear();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "When is the next Fed meeting?",
              acceptedAnswer: {
                "@type": "Answer",
                text: next
                  ? `The next FOMC meeting is on ${formatLongDate(next.meeting.meeting_date)}.`
                  : "The next FOMC meeting date will be shown here once scheduled.",
              },
            },
            {
              "@type": "Question",
              name: "Will the Fed cut rates at the next meeting?",
              acceptedAnswer: { "@type": "Answer", text: summarize(next) },
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Fed", item: `${BASE_URL}/fed` },
          ],
        }}
      />

      <header className="mb-12">
        <SectionLabel>Federal Reserve (FOMC)</SectionLabel>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
          {next ? `Next FOMC Meeting: ${formatLongDate(next.meeting.meeting_date)}` : "Next FOMC Meeting"}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          {summarize(next)}
        </p>
        {next && (
          <div className="mt-4 text-ink-mute">
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        )}
      </header>

      <Rule />

      {next && (
        <section className="my-12">
          <SectionLabel>Next meeting · outcome distribution</SectionLabel>
          <h2 className="mt-2 mb-6 font-serif text-3xl font-medium text-ink">
            Will the Fed cut rates on {formatShortDate(next.meeting.meeting_date)}?
          </h2>
          <ProbabilityTable data={next} history={[]} showDetailLink={false} />
          <Link
            href={`/meeting/${next.meeting.id}`}
            className="mt-4 inline-block text-sm text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            Full history &amp; detail →
          </Link>
        </section>
      )}

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>All {year} FOMC meetings</SectionLabel>
        <ul className="mt-4 divide-y divide-ink/10">
          {upcoming.map((m) => {
            const t = topOutcome(m);
            return (
              <li key={m.meeting.id}>
                <Link
                  href={`/meeting/${m.meeting.id}`}
                  className="flex items-center justify-between py-3 text-ink hover:text-cut"
                >
                  <span className="font-medium">{formatLongDate(m.meeting.meeting_date)}</span>
                  <span className="font-mono text-sm tabular-nums text-ink-mute">
                    {t.label === "Hold" ? "Hold" : t.label} · {Math.round(t.probability * 100)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.fed} format="auto" />
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          Probabilities are computed from Fed Funds futures and update twice per
          business day. See{" "}
          <Link href="/methodology" className="text-cut hover:text-ink underline-offset-4 hover:underline">
            methodology
          </Link>
          . Not financial advice.
        </p>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Build + verify the route renders and emits FAQ schema**

Run: `pnpm --filter web build`
Expected: build succeeds; output lists `/fed` as a route.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/fed/page.tsx
git commit -m "feat(web): /fed FOMC hub — next meeting, odds, schedule, FAQ schema"
```

---

### Task 4: `/ecb` ECB hub page (odds-free, honest)

**Files:**
- Create: `apps/web/src/app/ecb/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { MeetingCountdown } from "@/components/MeetingCountdown";
import { Rule } from "@/components/Rule";
import { SectionLabel } from "@/components/SectionLabel";
import { AD_SLOTS } from "@/lib/ad-slots";
import { getEcbProbabilities, pickNextMeeting } from "@/lib/data";
import { CURRENT_POLICY_RATE_LABELS } from "@/lib/policy-rates";

export const revalidate = 300;

const BASE_URL = "https://rateradar-web.vercel.app";

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const next = pickNextMeeting(await getEcbProbabilities());
  const title = next
    ? `Next ECB Meeting: ${formatShortDate(next.meeting.meeting_date)} — rate decision`
    : "Next ECB Meeting — Governing Council schedule";
  const description = next
    ? `The next ECB Governing Council rate decision is on ${formatLongDate(next.meeting.meeting_date)}. Current Deposit Facility Rate 2.00%; full meeting schedule and live tracking.`
    : "The next ECB Governing Council rate decision date, current Deposit Facility Rate, and full meeting schedule.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/api/og/default"] },
    alternates: { canonical: "/ecb" },
  };
}

export default async function EcbHubPage() {
  const meetings = await getEcbProbabilities();
  const next = pickNextMeeting(meetings);
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = [...meetings]
    .filter((m) => m.meeting.meeting_date >= todayISO)
    .sort((a, b) => (a.meeting.meeting_date < b.meeting.meeting_date ? -1 : 1));
  const year = next
    ? new Date(next.meeting.meeting_date).getFullYear()
    : new Date().getFullYear();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "When is the next ECB meeting?",
              acceptedAnswer: {
                "@type": "Answer",
                text: next
                  ? `The next ECB Governing Council monetary-policy meeting is on ${formatLongDate(next.meeting.meeting_date)}.`
                  : "The next ECB meeting date will be shown here once scheduled.",
              },
            },
            {
              "@type": "Question",
              name: "What is the current ECB interest rate?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "The ECB Deposit Facility Rate is currently 2.00%.",
              },
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
            { "@type": "ListItem", position: 2, name: "ECB", item: `${BASE_URL}/ecb` },
          ],
        }}
      />

      <header className="mb-12">
        <SectionLabel>European Central Bank (Governing Council)</SectionLabel>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
          {next ? `Next ECB Meeting: ${formatLongDate(next.meeting.meeting_date)}` : "Next ECB Meeting"}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          The ECB Governing Council sets the Deposit Facility Rate, currently 2.00%.
          {next ? ` The next decision is on ${formatLongDate(next.meeting.meeting_date)}.` : ""}
        </p>
        {next && (
          <div className="mt-4 text-ink-mute">
            <MeetingCountdown meetingDate={next.meeting.meeting_date} />
          </div>
        )}
      </header>

      <Rule />

      <section className="my-10 grid gap-8 border-y border-ink/15 py-8 sm:grid-cols-2">
        <div>
          <SectionLabel>Current rate</SectionLabel>
          <div className="mt-2 font-serif text-2xl font-medium text-ink">2.00%</div>
          <div className="mt-1 text-sm text-ink-mute">{CURRENT_POLICY_RATE_LABELS.ECB}</div>
        </div>
        <div className="sm:border-l sm:border-ink/15 sm:pl-8">
          <SectionLabel>Forward odds</SectionLabel>
          <div className="mt-2 text-ink-soft">
            Spot-anchored — market-implied forward probabilities for the ECB are
            not yet available (no free forward-rate source).
          </div>
          <Link
            href="/methodology"
            className="mt-2 inline-block text-sm text-cut hover:text-ink underline-offset-4 hover:underline"
          >
            How we calculate →
          </Link>
        </div>
      </section>

      <Rule tone="soft" />

      <section className="my-12">
        <SectionLabel>All {year} ECB meetings</SectionLabel>
        <ul className="mt-4 divide-y divide-ink/10">
          {upcoming.map((m) => (
            <li key={m.meeting.id}>
              <Link
                href={`/meeting/${m.meeting.id}`}
                className="flex items-center justify-between py-3 text-ink hover:text-cut"
              >
                <span className="font-medium">{formatLongDate(m.meeting.meeting_date)}</span>
                <span className="font-mono text-sm tabular-nums text-ink-mute">View →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="my-10" aria-label="Advertisement">
        <AdSlot slot={AD_SLOTS.ecb} format="auto" />
      </section>

      <Rule />

      <footer className="mt-10 pt-8 text-sm text-ink-mute">
        <p>
          ECB tracking is spot-anchored at the current Deposit Facility Rate. See{" "}
          <Link href="/methodology" className="text-cut hover:text-ink underline-offset-4 hover:underline">
            methodology
          </Link>
          . Not financial advice.
        </p>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: build succeeds; `/ecb` listed as a route.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/ecb/page.tsx
git commit -m "feat(web): /ecb hub — next meeting, current rate, schedule, honest spot-anchored note"
```

---

### Task 5: Retrofit `/meeting/[id]` for question intent

Three surgical edits to `apps/web/src/app/meeting/[id]/page.tsx`. Do NOT touch other content.

**Files:**
- Modify: `apps/web/src/app/meeting/[id]/page.tsx`

- [ ] **Step 1: Reframe `generateMetadata` title + description (question language)**

Find this block inside `generateMetadata`:

```ts
  const action = top.label === "Hold" ? "hold" : `move ${top.label}`;

  const title = `${bank} ${date} · markets price ${pct}% to ${action}`;
  const description =
    `Market-implied probabilities for the ${bank} ${date} rate decision, ` +
    `with 60 days of historical probability tracking.`;
```

Replace it with:

```ts
  const action = top.label === "Hold" ? "hold" : `move ${top.label}`;

  const title =
    bank === "FED"
      ? `Will the Fed cut rates on ${date}?`
      : `ECB rate decision ${date}: what to expect`;
  const description =
    bank === "FED"
      ? `Market-implied odds for the FOMC ${date} decision: ${pct}% chance to ${action}. Live probabilities with 60 days of history.`
      : `The ECB Governing Council meets on ${date}. Current Deposit Facility Rate 2.00%; market-implied tracking with 60 days of history.`;
```

- [ ] **Step 2: Compute the question + answer strings in the page component**

Find this line in `MeetingPage` (just after `const top = ...` / `const bank = ...`):

```ts
  const bank = data.meeting.bank_code;
```

Insert immediately after it:

```ts
  const shortDate = formatShortDate(data.meeting.meeting_date);
  const question =
    bank === "FED"
      ? `Will the Fed cut rates on ${shortDate}?`
      : `What will the ECB decide on ${shortDate}?`;
  const answer =
    bank === "FED"
      ? `Markets price a ${Math.round(top.probability * 100)}% chance the Fed will ${top.label === "Hold" ? "hold rates" : `move ${top.label}`} at the ${shortDate} FOMC meeting.`
      : `The ECB Governing Council meets on ${shortDate}. The current Deposit Facility Rate is 2.00%; forward odds are spot-anchored.`;
```

- [ ] **Step 3: Add FAQ JSON-LD + an `<h2>` question heading**

Find the closing of the BreadcrumbList `<JsonLd>` (the `/>` right before `<nav className="mb-8 ...`). Insert a third JSON-LD block immediately after it:

```tsx
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            },
          ],
        }}
      />
```

Then find the hero countdown block:

```tsx
        <div className="mt-4 text-ink-mute">
          <MeetingCountdown meetingDate={data.meeting.meeting_date} />
        </div>
```

Insert immediately after that closing `</div>` (still inside `<header>`):

```tsx
        <h2 className="mt-6 font-serif text-2xl font-medium text-ink-soft">
          {question}
        </h2>
```

- [ ] **Step 4: Build**

Run: `pnpm --filter web build`
Expected: build succeeds. (Compilation confirms `question`/`answer` are used, `schema-dts` FAQPage shape is valid, no `any`.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/meeting/\[id\]/page.tsx
git commit -m "feat(web): reframe meeting pages as question pages + FAQ schema"
```

---

### Task 6: Discoverability — NavBar links + sitemap

The NavBar renders on every page (including the homepage), so adding the links here satisfies "linked from the homepage" without editing `page.tsx`.

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx`
- Modify: `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Add Fed + ECB to the NavBar `LINKS` array**

Replace the `LINKS` array with (inserts `/fed` + `/ecb` after Dashboard):

```ts
const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/fed", label: "Fed" },
  { href: "/ecb", label: "ECB" },
  { href: "/compare", label: "Fed vs ECB" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/methodology", label: "Methodology" },
  { href: "/glossary", label: "Glossary" },
  { href: "/brokers", label: "Brokers" },
  { href: "/about", label: "About" },
];
```

- [ ] **Step 2: Add `/fed` + `/ecb` to the sitemap `staticPages` array**

In `apps/web/src/app/sitemap.ts`, add these two entries to the `staticPages` array (place them right after the `/` (home) entry):

```ts
    { url: `${BASE_URL}/fed`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/ecb`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
```

- [ ] **Step 3: Build**

Run: `pnpm --filter web build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/NavBar.tsx apps/web/src/app/sitemap.ts
git commit -m "feat(web): surface /fed + /ecb in nav and sitemap"
```

---

### Task 7: Final verification (build + lint + visual + schema)

No code. Run the full verification gate before opening the PR.

**Files:** none.

- [ ] **Step 1: Build + lint**

Run: `pnpm --filter web build && pnpm --filter web lint`
Expected: both succeed, zero errors. Confirm `/fed` and `/ecb` appear in the route list.

- [ ] **Step 2: Start the production server**

Run (background): `pnpm --filter web start`
Then wait for `Ready` on `http://localhost:3000`.

- [ ] **Step 3: Confirm FAQ JSON-LD is emitted on the hubs**

Run:
```bash
curl -s http://localhost:3000/fed | grep -o '"@type":"FAQPage"' | head -1
curl -s http://localhost:3000/ecb | grep -o '"@type":"FAQPage"' | head -1
```
Expected: each prints `"@type":"FAQPage"` (proves the schema renders server-side).

- [ ] **Step 4: Visual check (Playwright)**

Use the Playwright MCP browser to navigate + screenshot and eyeball each:
- `http://localhost:3000/fed` — H1 reads `Next FOMC Meeting: <date>`, odds table + schedule render, no console errors.
- `http://localhost:3000/ecb` — H1 reads `Next ECB Meeting: <date>`, current rate 2.00% + honest "spot-anchored" note, schedule renders.
- `http://localhost:3000/meeting/<any id from the schedule list>` — title/H2 read as a question, page otherwise unchanged.

- [ ] **Step 5: (Optional) validate rich results**

Paste the deployed `/fed` URL into Google's Rich Results Test after the preview deploy, or trust the Step-3 grep + build-time `schema-dts` type-check for the local gate.

- [ ] **Step 6: Stop the server** (terminate the background `start` process).

---

### Task 8: Non-blocking — Google Search Console (no code)

This is the measurement that matters for SEO (query impressions/rankings). Do it in parallel; it does not block the PR.

**Files:** none (dashboard config).

- [ ] **Step 1:** In Google Search Console, add/verify the `rateradar-web.vercel.app` property (URL-prefix property; verify via the existing AdSense/Google account or an HTML-tag meta in `layout.tsx` if needed).
- [ ] **Step 2:** Submit the sitemap: `https://rateradar-web.vercel.app/sitemap.xml`.
- [ ] **Step 3:** After ~1–2 weeks, check Performance → Queries for `next fed meeting`, `will the fed cut rates …`, `next ecb meeting` and confirm `/fed` + `/ecb` are indexed (Pages report).

> **Deferred follow-up (out of scope here):** PostHog page-view instrumentation. `lib/analytics.ts`'s `initAnalytics()` is currently a stub (it does not load `posthog-js`), so setting `NEXT_PUBLIC_POSTHOG_KEY` alone captures nothing. A real integration (add `posthog-js`, init it, capture `$pageview` on route change via a Suspense-wrapped client provider mounted in `layout.tsx`) is a separate, lower-priority task — GSC above is the SEO-critical, no-code measurement. Track it separately if on-site behavior analytics is wanted.

---

### Follow-up after merge (not code tasks)

- Create 2 AdSense display units (pub `ca-pub-6563643868702361`); set `NEXT_PUBLIC_AD_SLOT_FED` + `NEXT_PUBLIC_AD_SLOT_ECB` as Vercel **production** env vars (gated on explicit user OK per session). Until then the `/fed` + `/ecb` ad slots render nothing — merge-safe.
- Finish the branch via the `superpowers:finishing-a-development-branch` skill (PR → CI → squash-merge).

---

## Self-review

**Spec coverage** (checked against `2026-06-08-rateradar-high-intent-seo-design.md`):
- `/fed` hub (H1, countdown, odds, schedule, explainer, ad, FAQ+Breadcrumb JSON-LD, canonical, revalidate) → Task 3 ✓
- `/ecb` hub (odds-free honest, current rate, schedule, FAQ) → Task 4 ✓
- `/meeting/[id]` retrofit (question metadata + FAQ JSON-LD + `<h2>`) → Task 5 ✓
- Sitemap + NavBar links + canonicals → Task 6 (canonicals set per-page in Tasks 3/4/5) ✓
- 2 new env-driven ad slots → Task 2 + follow-up ✓
- `pickNextMeeting` helper → Task 1 ✓
- Verification via build+lint+visual+schema (no test runner) → Task 7 ✓
- Analytics non-blocking (GSC now; PostHog deferred with rationale) → Task 8 ✓
- YAGNI exclusions (no new banks/content/data/domain) → respected; not built ✓

**Placeholder scan:** no TBD/TODO; every code step shows full code; commands have expected output. ✓

**Type consistency:** `pickNextMeeting(meetings): MeetingProbabilities | null` defined in Task 1, imported + called identically in Tasks 3 & 4. `AD_SLOTS.fed`/`AD_SLOTS.ecb` defined in Task 2, used in Tasks 3 & 4. `topOutcome`/`summarize`/`formatShortDate`/`formatLongDate` are page-local in Tasks 3 & 4 (no cross-file coupling). `question`/`answer` defined and used within Task 5. ✓
