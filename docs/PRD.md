# Product Requirements Document — RateRadar

**Status:** Draft v0.1 (pre-launch)
**Owner:** lawoflarge
**Last updated:** 2026-04-21

---

## 1. Problem

Retail traders, macro-curious investors, and finance students rely on two disconnected tools to read central-bank rate expectations:

- **CME FedWatch** (for the Fed) — canonical but dated UX, no historical probability view
- **ECB Watch** (ecb-watch.eu) — academic, current snapshot only, no Fed integration

Both have the same four gaps:
1. **No historical probability tracking.** You see today's odds but can't see how they moved last week.
2. **Fragmented.** No single product covers Fed + ECB.
3. **Dated UX.** Dense tables, poor mobile, no sharing.
4. **No engagement loop.** No alerts, no widgets, no iOS app.

## 2. Opportunity

Build a modern, mobile-first, combined Fed + ECB rate-expectations tracker with historical probability charts as the killer feature. Monetize via ads + broker affiliate from day 1.

## 3. Target users

### Primary — "Rate Trader Ryan"
- 28-45, active retail trader, follows macro
- Uses Twitter/Reddit (r/stocks, r/wallstreetbets)
- Checks FedWatch on FOMC days
- Wants quick mobile access to "did cut odds move today?"
- High ad engagement, high affiliate conversion

### Secondary — "Curious Clara"
- 22-35, finance/econ student or newbie investor
- Googles "what is priced in?", "how does the Fed decide rates?"
- Reads explainers, shares charts
- SEO and viral channel

## 4. Positioning

**Tagline:** *See where rates are headed — before the meeting.*

**Elevator pitch:** RateRadar combines Fed + ECB rate-decision probabilities in one modern app, and shows you how those probabilities have moved over days and weeks — the view every other tool is missing.

## 5. Scope

### MVP (in scope)

#### Parity features
1. Meeting probability table (Fed + ECB, each upcoming meeting, all possible outcomes)
2. Current probability snapshot (homepage hero module)
3. Conditional probabilities ("if Meeting A is X, then Meeting B...")
4. Meeting probability tree (visual most-likely-path)
5. Implied forward rate path (12-18 months out)
6. Methodology page

#### Differentiator features
7. **Historical probability chart** — daily snapshots for each outcome, 90-day window at launch
8. **Event overlays** on history — CPI, NFP, FOMC minutes, ECB speeches
9. **Probability delta highlights** — "Cut odds for March jumped +15% today"
10. **Timeline scrubber** — drag through past dates to see snapshot at that moment
11. **Compare Fed vs ECB** — side-by-side historical charts

#### Retail/viral features
12. Shareable chart cards (PNG export)
13. Plain-English meeting summaries
14. Meeting countdown widgets
15. Glossary tooltips

#### iOS-specific
16. Home screen widgets (small / medium / large)
17. Push notifications (probability-shift alerts, meeting-day reminders)
18. Apple Watch complication

#### Content (for Clara, drives SEO)
19. 5-10 explainer articles at launch
20. Historical narrative posts

### Out of scope (roadmap, not MVP)
- Pro tier (custom alerts, CSV/API export, advanced scenarios) → month 2-3
- BoE + BoJ coverage
- Weekly newsletter with sponsorships
- Embeddable widgets for third-party blogs
- Android app
- Siri shortcuts / App Intents
- Slack / Discord bot
- Real-time tick-level data
- User accounts / auth (deferred to Pro)

## 6. Revenue model

### MVP (day 1)
- **Ads** — Google AdSense on web, AdMob on iOS
  - Web: in-article placements only, never in core chart views; target $3-8 RPM (US finance retail)
  - iOS: banner on list screens + carefully placed interstitials; target $10-25 eCPM
- **Affiliate** — broker partnerships (Interactive Brokers, eToro, Trading212, Plus500)
  - Contextual placements: footer, `/brokers` page, post-article CTAs
  - Target $50-500 per qualified signup

### Post-launch (not built in MVP)
- Pro tier ($4.99-9.99/mo): ad-free, custom alerts, CSV/API export, advanced conditional scenarios — month 2-3
- Weekly newsletter sponsorships — month 6+ (once audience > 5k engaged)
- B2B/media API licensing — opportunistic

## 7. Non-functional requirements

### Performance
- Web Lighthouse (mobile): Performance > 85, SEO > 95, Accessibility > 90
- API p95: < 300ms (edge cache hit), < 1.5s (cache miss)
- iOS cold start: < 2s on iPhone 12+
- Widget render: < 500ms

### Reliability
- Data pipeline: at least one successful snapshot per business day; alert on failure
- Validation: snapshot probabilities within 2% absolute of live CME FedWatch

### Legal
- Probabilities computed in-house from licensed-free market data (no scraping)
- Methodology transparent in `docs/METHODOLOGY.md`
- Clear "not financial advice" disclaimer on all pages

### Accessibility
- WCAG 2.1 AA compliance for web (contrast, keyboard nav, semantic HTML)
- Dynamic Type support on iOS
- Color-blind-safe palettes for charts (don't rely on red-green alone)

## 8. Success metrics

### Launch (first 30 days)
- Web: > 10k sessions, > 30k pageviews
- iOS: > 500 installs
- Data pipeline: 100% of scheduled snapshots succeeded
- Validation: 0 days with > 2% divergence from FedWatch

### 90 days post-launch
- Web: > 50k monthly sessions
- iOS: > 5k installs, > 1k DAU on Fed/ECB meeting days
- Revenue: first $100 combined from ads + affiliate
- Community: > 3 Product Hunt upvotes, > 100 Twitter followers

### 6 months
- Web: > 200k monthly sessions
- iOS: 4.5+ star rating with > 50 reviews
- Revenue: $500+/month recurring from ads + affiliate; Pro tier launched

## 9. Build sequencing

See `staged-booping-dove.md` plan file (or `docs/ROADMAP.md` once consolidated). Summary:
- **Weeks 1-3:** foundation — monorepo, Supabase schema, pipeline v1 (Fed only), Next.js + Xcode scaffolding
- **Weeks 3-6:** web MVP (Fed-only), AdSense, soft launch
- **Weeks 5-9 (overlap):** ECB data, iOS skeleton, AdMob
- **Weeks 9-12:** iOS widgets/push, shareable cards, content, public launch

## 10. Key risks

| Risk | Mitigation |
| --- | --- |
| yfinance rate limits or stops | Stooq + FRED fallbacks, caching, monitoring |
| Probabilities diverge from FedWatch | Validation job every snapshot, alert > 2% |
| AdBlock dominant in finance audience | Affiliate revenue not blocked; plan Pro tier |
| Domain `rateradar.com` unavailable (squatted) | Launch on `rateradar.vercel.app` (free subdomain); negotiate/purchase `.com` post-traction |
| App Store "data redistribution" rejection | Transparent methodology, we compute our own numbers |
| SEO cold-start vs FedWatch | Long-tail targeting + explainer content strategy |
| Swift + Next.js context-switching for solo dev | Sequence web first (weeks 3-6), iOS staggered behind |

## 11. Open questions (for product owner)

- Domain preference: `.com`, `.app`, `.io`, or `.finance`?
- Repo public at launch (SEO/community) or private until stable?
- Broker affiliate priority — US-first (IBKR, Robinhood partners) or EU-first (eToro, Trading212)?
- Analytics: PostHog cloud (managed) vs self-host?
- Data pipeline hosting: Railway vs Fly.io vs GitHub Actions cron?

## 12. Appendix — Methodology

See `docs/METHODOLOGY.md` for the full probability calculation. In short:
- Fed: pull 30-Day Fed Funds Futures (ZQ) prices via yfinance; compute `implied_rate = 100 - price`; decompose into outcome probabilities via step-function over consecutive meetings.
- ECB: pull €STR OIS quotes via Stooq; same step-function decomposition anchored to the Deposit Facility Rate.
- Snapshots written to Supabase twice per business day + every 15 min on meeting days.

## Growth content surfaces (added 2026-05-20)

In addition to the live odds dashboard, the data pipeline emits derived content
for visitor acquisition: a deterministic Daily Brief per cron run, per-meeting
annotated timelines, a market-vs-actual scoreboard, and SVG embed widgets. All
outputs are static files committed to `content/` by the same cron that writes
snapshots — no new runtime cost surface.

Spec: `docs/superpowers/specs/2026-05-20-rateradar-growth-bundle-design.md`.
