# RateRadar — Claude Guidance

You are working on RateRadar, a Fed + ECB interest-rate probability tracker (web + iOS).

Read this before touching code. It encodes the decisions we've already made and the pitfalls we've already discussed.

## Product non-negotiables

1. **We compute our own probabilities.** Never scrape CME FedWatch or ECB Watch. All probabilities come from `services/data-pipeline`, using the step-function decomposition documented in `docs/METHODOLOGY.md`, applied to raw futures prices pulled from yfinance / stooq / FRED. This is a legal, App Store, and trust requirement.

2. **Historical probability tracking is the differentiator.** Every product decision should strengthen it. We snapshot probabilities at least twice per business day and retain forever. If a feature dilutes or hides the historical view, push back.

3. **Methodology transparency is a trust signal.** `docs/METHODOLOGY.md` is canon. When changing the calculation, update the methodology doc in the same PR and bump the version. Never silently adjust numbers.

4. **Target audience is retail first.** Finance jargon is fine but never unexplained — a glossary tooltip or link to an explainer article is required when introducing a term. Assume the reader knows what a stock is but not what "basis points" means.

## Architecture invariants

- **API contract lives in `packages/api-contract/openapi.yaml`.** Web and iOS both generate types from it. Never define request/response shapes anywhere else.
- **Pipeline math is pure and unit-tested.** `probability_calc.py` must have no I/O. If you need to refactor, keep the purity.
- **Supabase writes go through the service-role key in the pipeline only.** Never embed the service-role key in web or iOS — use the anon key with RLS-gated public reads.
- **Web fetches from `/api/*` routes, not directly from Supabase client-side.** Keeps caching consistent between browsers and the iOS app.

## Style

- **TypeScript:** strict mode, no `any`. Favor Zod schemas at I/O boundaries.
- **Python:** `black` + `ruff`. Type-annotated. Tests in `pytest`.
- **Swift:** SwiftUI only (no UIKit unless forced). `@Observable` over `ObservableObject`. Async/await over Combine.
- **Commits:** conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Every PR gets a passing CI check.

## Testing

- Probability math: unit tests are mandatory. Any new outcome decomposition or calendar edge case needs a regression test.
- Web: component tests for chart rendering (fixture data + snapshot). E2E smoke test for homepage → meeting detail → historical chart.
- iOS: unit tests for APIClient decoding; SwiftUI previews for every view.

## Performance

- Web: Lighthouse targets (mobile) — Performance > 85, SEO > 95, Accessibility > 90. Don't regress these.
- iOS: widgets must render < 500ms; main app cold start < 2s on iPhone 12+.
- API: p95 response time < 300ms from edge cache; < 1.5s on cache miss.

## What NOT to do

- Don't add real-time tick data. Our cadence is deliberately "after-session plus meeting-day refreshes". Tick data is a legal/cost rabbit hole.
- Don't add user accounts for MVP. Auth is deferred to the Pro tier (month 2-3). Don't pre-build it.
- Don't add analytics tracking per click until we have PostHog baseline. Start with page views + core events (`meeting_viewed`, `chart_interacted`, `ad_clicked`, `broker_referral_clicked`).
- Don't scrape. Don't mirror. Don't republish CME/ECB Watch UI.
- Don't add Android or BoE/BoJ coverage in MVP. Documented in `docs/PRD.md` as roadmap.

## When in doubt

Check `docs/PRD.md` for what's in scope, `docs/METHODOLOGY.md` for how probabilities are calculated, `docs/ARCHITECTURE.md` for the system layout. When the docs disagree with the code, trust the docs and fix the code (or update the docs — make the call and commit to it).
