# RateRadar Growth Bundle — Design Spec

**Date:** 2026-05-20
**Author:** Levin (with Claude)
**Status:** Approved, ready for implementation planning
**Scope:** Five visitor-attraction features built on one shared content-generation layer, with a hard zero-ongoing-cost constraint.

## 1. Goals & non-goals

### Goals

- Ship five visitor-attraction features as one coordinated flywheel: **A1 Daily Brief**, **A2 Rich meeting pages**, **C1 Embed widget**, **B1 Surprise scoreboard**, **B2 Interactive replay**.
- **Zero ongoing cost.** No new paid services. No LLM calls at runtime. No ffmpeg in Vercel functions. No email infra (deferred). Only services in use: existing Vercel free tier, existing Supabase free tier (with git-JSON fallback already in place), existing GitHub Actions minutes, existing FRED free API.
- iOS WebView shell continues to work unchanged — every web feature appears in the app automatically via the next Vercel redeploy.
- All five features survive a Supabase pause, matching the v2 pattern shipped 2026-05-14.

### Non-goals

- Newsletter / email sending (would require Resend or similar; revisit after measuring brief engagement).
- LLM-written commentary in the Daily Brief (deterministic templating only).
- BoE / BoJ coverage (still scope-deferred per `docs/PRD.md`).
- Auth, user accounts, comments.
- Server-side MP4 export of replays (interactive in-page playback only for v1).
- Public read-only API (the `/embed` page reserves `/developers` for a future iteration).

## 2. Architecture — the shared foundation

All five features depend on one new layer: a deterministic **snapshot diff engine** that runs inside the existing GitHub Actions cron, commits its output as static JSON / SVG to a new `content/` directory at the repo root, and is read by web pages at build time and via ISR.

**How `apps/web` reads `content/`.** Mirrors the existing `apps/web/src/lib/snapshots.ts` pattern: in dev, reads local files via `fs`; in prod (Vercel build env), fetches the same paths from `https://raw.githubusercontent.com/lawoflarge/rateradar/main/content/...`. A new `apps/web/src/lib/content.ts` module is the single point of access. No symlinks. No build-step copies. Same fallback semantics as snapshots.

```
GitHub Actions cron (existing, twice-daily)
    │
    ├─► data-pipeline (existing): fetch futures → compute probabilities
    │                              → write snapshot JSON to services/data-pipeline/snapshots/
    │
    ├─► NEW: diff-engine (services/data-pipeline/diff_engine.py)
    │     ├── reads today's snapshot + last N snapshots
    │     ├── joins against actuals.json (manual)
    │     ├── joins against FRED release calendar
    │     ├── writes content/briefs/YYYY-MM-DD.json           ← A1 Daily Brief
    │     ├── writes content/briefs/index.json                ← brief list / RSS source
    │     ├── writes content/meetings/<id>/timeline.json      ← A2 annotated history
    │     ├── writes content/scoreboard.json                  ← B1 rolling hit-rate
    │     └── writes content/embed/<meeting>.svg              ← C1 static embeds
    │
    └── auto-commits everything (existing pattern, see ba2cc16)

Vercel (apps/web)
    ├── Next.js reads content/*.json at build time + ISR (revalidate = 3600)
    ├── SVG embeds served by a passthrough route handler with explicit cache headers (edge-cached)
    ├── RSS feed served by a route handler that renders content/briefs/index.json at build time
    ├── No new serverless functions on the hot path
    └── iOS WebView picks up everything via the next deploy
```

**Why this matters for the cost constraint:** every feature output is a static file. Vercel serves them as static edge assets. No serverless function on the hot path. No database call. No third-party API on render.

**One new external dependency, free-tier safe:** the FRED release calendar API (already a project dependency; key already provisioned). Used to label which calendar date a probability shift coincides with — e.g. "following 2026-05-14 CPI print". One call per cron run. Well under the 120 req/min limit.

## 3. Per-feature spec

### A1 — Daily Rates Brief

**Routes**
- `/brief` — index page, list of recent briefs.
- `/brief/[YYYY-MM-DD]` — per-day brief.
- `/brief/feed.xml` — RSS feed served by a Next.js route handler that reads `content/briefs/index.json` (cron-written) and renders RSS XML at build time + ISR. Listed in `sitemap.ts`.

**Content (deterministic template, no LLM)**
- Headline: `Today's biggest probability shift` — computed as max absolute delta across all outcomes in the next six meetings vs the previous snapshot.
- Top-3 shifts table: meeting, outcome, prior %, today %, Δ.
- "Implied path now" mini-chart — reuses the existing `MostLikelyPath` component.
- "Calendar context" strip: did a CPI / NFP / FOMC-minutes / ECB-speech land in the last 24 hours? Rendered from the FRED release calendar lookup at cron time. If nothing landed, this section is omitted.
- Permalink + share buttons (reuses existing `ShareButtons` component).

**Generation**
- `diff-engine` writes `content/briefs/YYYY-MM-DD.json`. Page built as ISR (`revalidate = 3600`). New brief appears within an hour of the cron landing.
- An empty-snapshot day (cron failure, weekend with no data) produces no `content/briefs/<date>.json` entry. `/brief` (index) always shows the most recent brief that exists; `/brief/[date]` for a missing date returns 404 with a "No brief was published on this date" page that links back to the index.

**SEO surface**
- RSS feed at `/brief/feed.xml`.
- Each brief is added to `sitemap.ts`.
- Internal link from homepage `MethodologyBadge` row to today's brief.

**Cost:** zero. Build minutes only; no runtime API calls.

---

### A2 — Rich per-meeting evergreen pages

**Route:** `/meeting/[id]` — extend the existing route.

**New sections (rendered below the existing historical chart)**

1. **Sentiment timeline.** Existing 60-day series rendered as a sparkline annotated with the three biggest single-day shifts. Each annotation labeled with the FRED-detected release that occurred that day. Example: "2026-05-14: +5pp toward 25bp cut following May CPI print (0.2% vs 0.3% expected)."

2. **Plain-English summary** (one sentence per outcome). Auto-generated by template, not by LLM. Example: "Sixty days ago the market gave a 25bp cut a 38% probability. Today it gives 71%." Five sentences total at most.

3. **Post-meeting block** (only on past meetings — gated by `actuals.json` containing this meeting). Shows: actual outcome, day-before market estimate, calibration verdict (`hit` if day-before top outcome matched actual, else `miss`). Pulled from `scoreboard.json`.

4. **Related meetings sidebar.** Same bank, two adjacent dates on either side. Internal links boost the SEO graph.

**Generation:** all data from existing snapshot history plus the new `timeline.json` per meeting written by the diff engine. Static at build, ISR `revalidate = 3600`.

**Cost:** zero.

---

### C1 — Embed widget

**Two embed formats** so embedders can pick by their site's CSP:

1. **Static SVG embed (preferred).**
   ```html
   <img src="https://rateradar-web.vercel.app/embed/[meeting-id].svg"
        width="600" height="200"
        alt="Live Fed rate decision odds — RateRadar" />
   ```
   The SVG is a pre-rendered 600×200 Wire Room mini-card. Contains: meeting headline (bank + date), current top-outcome odds with sparkline, "Powered by RateRadar" footer (the backlink). Regenerated by the diff engine whenever a new snapshot lands.

   **Serving path.** A thin Next.js route handler at `apps/web/src/app/embed/[id].svg/route.ts` reads the SVG via `content.ts` and returns it with `Content-Type: image/svg+xml` and `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=86400`. The handler does no computation — it's a passthrough with explicit headers. Vercel edge-caches the response, so steady-state cost is one edge-cached asset per meeting.

2. **iframe embed (fallback).**
   ```html
   <iframe src="https://rateradar-web.vercel.app/embed/[meeting-id]"
           width="600" height="200" frameborder="0"
           title="Live Fed rate decision odds — RateRadar"></iframe>
   ```
   Same Wire Room mini-card rendered as an HTML page. Static HTML, no JS required.

**Promo page:** `/embed` — copy-paste snippet generator. Lists upcoming meetings, lets the visitor pick one, shows both snippet variants with a one-click copy button. Defaults to the SVG form.

**Attribution:** the "Powered by RateRadar" footer is baked into the SVG and the iframe HTML. Non-removable in v1. This is the backlink loop and the entire reason the embed exists.

**Bandwidth ceiling.** Each SVG ≤ 5 KB. Vercel free tier = 100 GB/month → ~20 million views/month tolerance per embed. If a finfluencer goes viral and we exceed the tier, the failure mode is "Vercel stops serving until the next month" — never a surprise bill. Acceptable.

**Cost:** zero. Hard-capped by Vercel free tier; no usage billing possible.

---

### B1 — Surprise scoreboard

**Route:** `/scoreboard`.

**Content**
- Market hit-rate over the last N meetings — % of meetings where the day-before top outcome matched the actual. Computed from `scoreboard.json`.
- Per-bank breakdown — Fed hit-rate vs ECB hit-rate.
- "Biggest misses" table — meetings where the market was most wrong, sorted by `|day_before_top_prob − 1{actual == top}|`. Each row links to the meeting page.
- "Longest correct streak" stat — most consecutive meetings where the day-before top outcome was correct.
- Sparkline of rolling hit-rate over time.

**Data source.** `actuals.json` lives at `services/data-pipeline/actuals.json` (next to the snapshot data it joins against). Manually appended by Levin after each meeting:
```json
{ "meeting_id": "fed-2026-06-17", "decision": "cut_25", "decision_bps": -25, "effective_date": "2026-06-17" }
```
One line per meeting. Eight Fed + eight ECB meetings per year → ~16 manual appends per year, each takes well under a minute. Diff engine joins `actuals.json` against the day-before snapshot per meeting → `scoreboard.json`.

**Why manual rather than automated.** Automating actuals would require parsing Fed / ECB press releases or relying on a third-party data feed — adds external dependencies and edge cases (corridor changes, mid-meeting surprises, BoJ-style yield-curve tweaks). Manual is zero cost, zero risk, low overhead. Acceptable for the cadence.

**Cost:** zero.

---

### B2 — Interactive replay

**Where it lives:** added to `/meeting/[id]` only in v1. The `/scoreboard` page links into per-meeting replays via the existing meeting-row links rather than embedding a scrubber inline — keeps `/scoreboard` focused on aggregate stats.

**UX:** a small slider/scrubber under the historical chart on `/meeting/[id]`. Dragging it redraws the chart to show the probability distribution as of that day. A "play" button animates the slider from day −60 to today over ~5 seconds. Pure SVG + JavaScript; all data already present in the existing `MeetingHistory` series consumed by `HistoricalChart`.

**No file generation, no MP4, no ffmpeg.** The animation is a render-time effect on data we already have. Zero new files to host.

**Future MP4 export.** If Twitter / X posting becomes a regular ritual, add a Playwright-in-GitHub-Actions step that renders an MP4 once per meeting and commits it under `content/replays/<meeting-id>.mp4`. Out of scope for v1. Tracked as a follow-up only — not a deliverable here.

**Cost:** zero.

## 4. Zero-cost guarantees (the budget)

| Cost surface | Risk | Mitigation in this design |
|---|---|---|
| Vercel function invocations | Hot routes hit serverless | All five features are static + ISR. No server actions. No serverless route on the hot path. |
| Vercel bandwidth | Embed widget gets popular | SVG embeds ≤ 5 KB. ~20M views/month tolerance on free tier. Failure mode is "stop serving", never a surprise bill. |
| Supabase | Free-tier pause | Already mitigated — git-JSON fallback in place since v2. New features read JSON, never call Supabase. |
| LLM API | Per-render cost creep | Templates only. No `anthropic` / `openai` imports anywhere in the new code. CI lint rule to enforce. |
| FRED API | Rate limit | One call per cron run (twice daily). Limit is generous (120 req/min). |
| Image rendering | Server-side image gen | OG images already work via @vercel/og at edge (free). SVG embeds are emitted by the cron — never rendered at request time. |
| Email / newsletter | Out of scope | Not building in v1. RSS feed only. |
| ffmpeg / video | Out of scope | Interactive playback only. MP4 export is a future iteration. |
| GitHub Actions minutes | Cron getting heavier | Diff engine adds ~10s per cron run; existing budget has plenty of headroom. |

**Hard ceiling:** if any feature ever needs paid infrastructure, it does not ship under this spec.

## 5. Sequencing (one spec, five PRs)

Each PR ships independently and adds visitor value on its own.

1. **PR-1 — diff-engine foundation.** Adds `services/data-pipeline/diff_engine.py`. Writes `content/briefs/YYYY-MM-DD.json`, `content/briefs/index.json`, `content/meetings/<id>/timeline.json`, `content/scoreboard.json`, `content/embed/<meeting>.svg`. Wires into the existing GitHub Actions cron. Adds `actuals.json` with the meetings we already have outcomes for. Unit tests for the diff math. **No web changes.**

2. **PR-2 — A2 Rich meeting pages.** Extends `apps/web/src/app/meeting/[id]/page.tsx` to consume `timeline.json`. Smallest UI delta among the four consumer PRs. Validates the pipeline end-to-end.

3. **PR-3 — A1 Daily Brief + RSS.** New `/brief` and `/brief/[date]` routes. RSS feed at `/brief/feed.xml`. Updates `sitemap.ts`. Adds a "today's brief" link to the homepage `MethodologyBadge` row.

4. **PR-4 — C1 Embed widget + `/embed` promo page.** Serves SVG embeds from `content/embed/`. Adds the `/embed` promo page with copy-paste snippet generator.

5. **PR-5 — B1 Scoreboard page + B2 interactive replay.** Final consumer of the foundation. `/scoreboard` route. Adds the slider/scrubber + "play" control to `HistoricalChart` (or as a sibling component).

**Estimated calendar:** ~1–2 weekends per PR at a side-project pace. Whole bundle done in ~6 weeks of weekend work. Individual features valuable from week 2.

## 6. Decisions resolved during brainstorming

| Question | Decision |
|---|---|
| Actuals workflow | Manual append to `actuals.json` after each meeting. ~16 appends/year. |
| Daily Brief tone | Templates-only. No LLM. Honors the strict zero-cost constraint. |
| Embed attribution | "Powered by RateRadar" baked into the SVG/iframe footer. Non-removable in v1. |
| Promo page URL | `/embed` (clearer than `/developers` for non-devs; `/developers` reserved for a future API doc). |

## 7. Open follow-ups (deliberately deferred)

- **Email newsletter** — wrap the daily brief once we see organic RSS traction.
- **Public read-only API + `/developers`** — once embed traction proves there's developer interest.
- **MP4 export of replays** — once weekly Twitter / X posting becomes a habit.
- **German-language site** — independent track; not blocked by this bundle.
- **BoE / BoJ coverage** — still PRD-deferred.

## 8. Files touched (preview, for the planner)

```
NEW
  services/data-pipeline/diff_engine.py
  services/data-pipeline/tests/test_diff_engine.py
  services/data-pipeline/actuals.json
  apps/web/src/app/brief/page.tsx
  apps/web/src/app/brief/[date]/page.tsx
  apps/web/src/app/brief/feed.xml/route.ts
  apps/web/src/app/embed/page.tsx              (promo / snippet generator)
  apps/web/src/app/embed/[id]/page.tsx         (iframe fallback HTML)
  apps/web/src/app/embed/[id].svg/route.ts     (SVG passthrough with cache headers)
  apps/web/src/app/scoreboard/page.tsx
  apps/web/src/lib/content.ts            (loads content/*.json with the same git-fallback pattern as snapshots.ts)
  apps/web/src/components/BriefCard.tsx
  apps/web/src/components/EmbedSnippet.tsx
  apps/web/src/components/ReplayScrubber.tsx
  apps/web/src/components/ScoreboardTable.tsx
  apps/web/src/components/AnnotatedSparkline.tsx
  content/briefs/                        (cron-managed, gitkept)
  content/meetings/                      (cron-managed, gitkept)
  content/embed/                         (cron-managed, gitkept)
  content/scoreboard.json                (cron-managed)

CHANGED
  apps/web/src/app/meeting/[id]/page.tsx
  apps/web/src/app/sitemap.ts
  apps/web/src/components/MethodologyBadge.tsx   (link to today's brief)
  .github/workflows/pipeline-cron.yml            (invoke diff-engine after snapshot)
  docs/PRD.md                                    (document the new surfaces)
```

## 9. Cross-references

- `docs/METHODOLOGY.md` — version stays the same; this spec adds no calculation changes.
- `docs/PRD.md` — to be updated in PR-1 to note the new content surfaces in scope.
- `docs/ARCHITECTURE.md` — to be updated in PR-1 with the new diff-engine arrow.
- Memory: `[[project_rateradar]]` — to be updated after the bundle ships.
- Memory: `[[feedback_supabase_freetier_pause]]` — pattern reused; new code follows it.
- Memory: `[[feedback_landing_copy_no_em_dashes]]` — applies to all new copy.
- Memory: `[[feedback_branch_hygiene]]` — each PR uses a branch, gets merged, branch deleted locally + remotely.
- Memory: `[[feedback_agent_git_guardrail]]` — agents commit to branches, not master; Levin merges.
