# Architecture

## System overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          External Data Sources                           │
│  yfinance (CME ZQ)    Stooq (€STR OIS)    FRED API (fallback rates)     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ (pull, scheduled)
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   services/data-pipeline (Python)                        │
│                                                                          │
│   ┌────────────────┐   ┌─────────────────────┐   ┌──────────────────┐   │
│   │  fed_fetcher   │──▶│  probability_calc   │──▶│  supabase_writer │   │
│   │  ecb_fetcher   │   │  (step-function     │   │  (upsert snapshot)│  │
│   └────────────────┘   │   decomposition)    │   └──────────────────┘   │
│                        └─────────────────────┘                          │
│                                                                          │
│   Scheduler: cron on Railway / Fly.io                                    │
│   - daily @ 22:00 UTC (US close) + @ 18:00 UTC (EU close)                │
│   - meeting-day: every 15 min                                            │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ write
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Supabase (Postgres + Auth)                          │
│                                                                          │
│   central_banks  →  meetings  →  outcomes  →  probability_snapshots      │
│                                                                          │
│                      events  (CPI, NFP, speeches — chart overlays)       │
│                                                                          │
│                      users  (reserved, Pro tier)                         │
└─────────────────┬────────────────────────────┬───────────────────────────┘
                  │ (RLS-gated read)           │
                  ▼                            ▼
┌──────────────────────────┐       ┌───────────────────────────┐
│  Next.js API routes      │       │  Direct REST (Swift)      │
│  (edge cache 5 min)      │       │  URLSession + Codable     │
│                          │       │                           │
│  /api/meetings/...       │◀──────│  Uses same contract       │
│  /api/banks              │       │  from packages/api-contract│
│  /api/events             │       │                           │
└──────────┬───────────────┘       └───────────┬───────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────┐       ┌───────────────────────────┐
│   apps/web (Next.js)     │       │    apps/ios (SwiftUI)     │
│                          │       │                           │
│  - Homepage snapshot     │       │  - Home view              │
│  - Meeting detail +      │       │  - Probability table      │
│    historical chart      │       │  - Historical chart       │
│    (Recharts / Tremor)   │       │    (Swift Charts)         │
│  - Conditional probs     │       │  - Widgets (WidgetKit)    │
│  - Compare Fed vs ECB    │       │  - Push notifications     │
│  - /brokers (affiliate)  │       │  - AdMob                  │
│  - Explainer articles    │       │                           │
│  - AdSense               │       │                           │
│  (Vercel)                │       │  (TestFlight → App Store) │
└──────────────────────────┘       └───────────────────────────┘
```

## Components

### `services/data-pipeline` — Python

Single source of truth for data acquisition + probability calculation. Runs on a cheap worker (Railway or Fly.io, ~$5/mo). Writes snapshots to Supabase via the service-role key.

**Responsibilities:**
- Fetch raw futures / OIS prices from configured sources
- Compute probabilities using the step-function decomposition (see `METHODOLOGY.md`)
- Validate snapshot against live CME FedWatch; log divergence
- Write snapshot to `probability_snapshots`

**Design rules:**
- Pure functions in `probability_calc.py` — fully unit-testable, no I/O
- I/O isolated to `*_fetcher.py` and `supabase_writer.py`
- No Supabase client in core logic — easy to unit-test the math
- Meeting calendar in a static YAML; validated annually

### `infra/supabase` — Postgres

**Schema (see `supabase/migrations/20260421000000_initial.sql`):**

```sql
central_banks (id uuid, code text unique, name text)
meetings (id uuid, bank_id uuid, meeting_date date, status text)
outcomes (id uuid, meeting_id uuid, label text, delta_bps int)
probability_snapshots (
    id bigserial, outcome_id uuid, probability numeric(6,4),
    snapshot_at timestamptz,
    PRIMARY KEY (outcome_id, snapshot_at)
)
events (id uuid, bank_id uuid, date date, kind text, description text)
users (id uuid, email text, created_at timestamptz)  -- reserved
```

**Indexes:**
- `probability_snapshots (outcome_id, snapshot_at DESC)` — historical chart queries
- `meetings (bank_id, meeting_date)` — upcoming-meeting lookups

**RLS:**
- All reads public (data is free tier, ad-supported)
- Writes restricted to service role (pipeline only)

### `apps/web` — Next.js 14 App Router

- **Deployment:** Vercel (automatic preview deploys per PR)
- **Data:** Server Components fetch from Supabase via a thin API-route wrapper (enables consistent edge caching)
- **Caching:** Vercel edge cache with `s-maxage=300, stale-while-revalidate=600`; revalidated by pipeline-triggered webhook
- **Charts:** Tremor (built on Recharts) for dashboard UIs; fallback to raw Recharts for custom viz
- **UI primitives:** shadcn/ui + Tailwind CSS
- **Meta / SEO:** per-page `generateMetadata`, dynamic OG image generation via Satori, sitemaps per bank + meeting
- **Ads:** single `<AdSlot>` component; AdSense script loaded lazily (non-blocking)
- **Analytics:** PostHog (client) + Vercel Analytics (server/edge)

### `apps/ios` — Swift + SwiftUI

- **Target:** iOS 17+ (Swift Charts, Observation framework)
- **Project structure:**
  ```
  RateRadar/
  ├── App.swift
  ├── Views/             # HomeView, MeetingDetailView, HistoricalChartView, CompareView
  ├── Widgets/           # Small/Medium/Large WidgetKit widgets + Apple Watch
  ├── Services/          # APIClient, NotificationService
  ├── Models/            # OpenAPI-generated Codable models
  └── Resources/
  ```
- **State:** `@Observable` + `SwiftData` for local persistence of last-seen snapshots (offline support)
- **Networking:** URLSession + typed API client generated from `packages/api-contract/openapi.yaml`
- **Charts:** Native Swift Charts — handles interactive selection, annotations, multi-series out of the box
- **Widgets:** WidgetKit with `TimelineProvider` refreshing every 30 min (configurable)
- **Push:** APNs via Supabase Edge Function (triggered by pipeline when probability deltas exceed threshold)
- **Ads:** Google Mobile Ads SDK; banner + interstitial placement

### `packages/api-contract` — OpenAPI

Single source of truth for endpoints, request/response shapes. Both web (TS types via `openapi-typescript`) and iOS (Swift models via `swift-openapi-generator`) consume the same schema.

**Endpoints (v0):**
```
GET  /api/banks
GET  /api/meetings?bank=FED&upcoming=true
GET  /api/meetings/:id/probabilities               # current snapshot
GET  /api/meetings/:id/probabilities/history       # ?window=30d|90d|1y
GET  /api/meetings/:id/conditional?given=<outcome_id>
GET  /api/events?bank=FED&window=90d
GET  /api/brokers                                  # affiliate partner listings
```

## Data flow — "what happens when a user opens the homepage"

1. User visits `rateradar.vercel.app` (initial domain; custom domain planned post-launch)
2. Next.js Server Component calls `/api/meetings?bank=FED&upcoming=true`
3. Route handler queries Supabase (indexed lookup on `meetings (bank_id, meeting_date)`)
4. For each upcoming meeting, it also fetches the latest `probability_snapshots` row per outcome
5. Response is cached at Vercel edge for 5 minutes
6. HTML streams back to browser; hero section renders with current probabilities
7. Historical chart on meeting detail pages hydrates client-side with `/api/meetings/:id/probabilities/history?window=30d`

## Deployment topology

| Component | Host | Cost |
| --- | --- | --- |
| Web (Next.js) | Vercel Hobby (free, can upgrade) | $0 |
| Data pipeline | Railway or Fly.io | ~$5/mo |
| Database | Supabase Free tier | $0 (up to 500MB, plenty for snapshots) |
| Domain | Namecheap / Cloudflare Registrar | ~$12/yr |
| iOS builds | Xcode Cloud (free tier) or local + Fastlane | $0 |
| Monitoring | Vercel Analytics + Supabase logs + PostHog free | $0 |

Total fixed: ~$5/month infra + domain. Scales linearly only when traffic justifies upgrades.

## Scaling considerations (for post-launch)

- **Supabase connection limit:** switch to Supavisor pooler for serverless Next.js at scale
- **Snapshot table growth:** partition `probability_snapshots` by month once > 100M rows
- **Edge cache miss storms on meeting days:** pre-warm cache via pipeline-triggered webhooks after every snapshot
- **iOS widget refresh quota:** batch APNs triggers; use `TimelineProvider` budget efficiently
- **PostHog events:** self-host once we exceed 1M events/mo free tier

## Observability

- **Pipeline:** structured JSON logs, Sentry for exceptions, alert on > 2% divergence vs FedWatch
- **Web:** Vercel Analytics for perf, Sentry for JS errors, PostHog for funnels
- **iOS:** Firebase Crashlytics (free), PostHog iOS SDK for product analytics
- **Uptime:** BetterStack or UptimeRobot on homepage + key API endpoints
