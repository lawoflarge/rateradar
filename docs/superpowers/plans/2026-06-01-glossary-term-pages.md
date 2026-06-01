# Programmatic Glossary Term Pages — Implementation Plan (Phase 2)

**Goal:** Turn the 13-term glossary into 13 individually-indexable `/glossary/[term]` pages targeting long-tail "what is X" queries, to grow organic traffic and downloads. Pre-approved as Phase 2 of `2026-06-01-rateradar-growth-revenue-design.md`.

**Architecture:** Extract the `TERMS` array (currently local to `glossary/page.tsx`) into a shared module with stable slugs. Add a statically-generated `glossary/[term]` route. Link the index page entries to their detail pages. Add `DefinedTerm` JSON-LD + breadcrumbs + an ad slot on each term page. Add all term pages (and the missing `/scenarios`) to the sitemap.

**Tech Stack:** Next.js App Router (generateStaticParams + generateMetadata), schema-dts, existing JsonLd + AdSlot components.

**Branch:** `feat/glossary-term-pages` off `main`. One PR.

**Verification:** `pnpm --filter web build` + `lint` + Safari visual + live curl of a term page after deploy. No test runner (per repo reality).

---

## Task 1: Extract shared glossary-terms module
- Create `apps/web/src/lib/glossary-terms.ts`: `GlossaryTerm` type `{ slug; term; def }`, `TERMS` array with the 13 existing defs verbatim + explicit kebab slugs (basis-points, fomc, fed-funds-target-rate, deposit-facility-rate, estr, ois, fed-funds-futures, priced-in, hawkish-dovish, terminal-rate, conditional-probability, implied-rate-path, cumulative-pricing), `getTerm(slug)` helper.
- `glossary/page.tsx`: import from module, drop local TERMS, link each entry to `/glossary/{slug}`.
- Build green → commit.

## Task 2: The `[term]` detail route
- Create `apps/web/src/app/glossary/[term]/page.tsx`: `generateStaticParams` over slugs; `generateMetadata` (title `{term}`, desc = first sentence, canonical, OG); component with breadcrumb, `<h1>`, definition, 4 related-term links, links to `/methodology` + `/`, `<AdSlot slot={AD_SLOTS.glossary}/>`, `JsonLd` DefinedTerm + BreadcrumbList; `notFound()` on miss.
- Build prerenders 13 pages + lint → commit.

## Task 3: Sitemap
- `sitemap.ts`: append term URLs (priority 0.5) + add missing `/scenarios` (0.7).
- Build + curl sitemap → commit.

## Task 4: Verify + PR
- Full build + lint green; Safari visual on index + 2 term pages; push; PR vs main; CI green; spot-check prod after merge.
