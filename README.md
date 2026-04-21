# RateRadar

> See where rates are headed — before the meeting.

Modern, mobile-first tracker for **Fed + ECB** interest-rate decisions with
**historical probability charts** — the feature neither CME FedWatch nor
ECB Watch ship today.

**Live:** <https://rateradar-web.vercel.app>

## What makes this different

- 📊 Full Fed + ECB coverage in one place — not two disconnected sites
- 📈 **60 days of historical probability charts** per meeting, color-coded by outcome
- 📉 Cumulative-pricing headline (Σ p<sub>i</sub> · Δ<sub>i</sub>) — the single number that matters
- 🌊 Implied forward rate curve per bank + Fed-vs-ECB divergence view
- 🔗 Deep-linkable meeting pages with dynamic Open Graph images (Twitter/iMessage unfurl)
- 🔀 Share buttons: Twitter / LinkedIn / copy-link
- 📖 Plain-English glossary + transparent methodology page
- 📱 Native iOS app scaffold (SwiftUI + Swift Charts)

## Repository layout

```
rateradar/
├── apps/
│   ├── web/                 # Next.js 16 + React 19 + Tailwind 4 + Recharts
│   └── ios/                 # Swift + SwiftUI + Swift Charts (iOS 17+, via XcodeGen)
├── services/
│   └── data-pipeline/       # Python: fetch → probability_calc → Supabase writer
├── packages/
│   └── api-contract/        # OpenAPI 3.1 schema shared by web + iOS
├── supabase/
│   ├── config.toml
│   └── migrations/          # Schema migrations (applied to prod project)
├── scripts/                 # Migration + seed + history-seed runners
├── docs/
│   ├── PRD.md               # Full product requirements
│   ├── METHODOLOGY.md       # How probabilities are calculated
│   ├── ARCHITECTURE.md      # System design + data flow
│   ├── DEPLOYMENT.md        # How to ship web, pipeline, iOS
│   └── CONTRIBUTING.md
├── .github/workflows/       # CI (lint/test/build) + scheduled pipeline cron
└── CLAUDE.md                # Instructions for Claude Code sessions on this repo
```

## Stack at a glance

| Surface | Tech |
| --- | --- |
| Web | Next.js 16 App Router, React 19, Tailwind 4, shadcn-style UI, Recharts |
| iOS | SwiftUI, Swift Charts, Observation framework, async/await URLSession |
| Data pipeline | Python 3.11, pandas, yfinance, tenacity, psycopg2 |
| Database | Supabase Postgres with RLS policies |
| API contract | OpenAPI 3.1 |
| Hosting | Vercel (web), Fly.io / Railway / GitHub Actions cron (pipeline) |
| Analytics | PostHog (scaffolded; activate with env var) |
| Ads & monetization | Google AdSense (web), AdMob (iOS), broker affiliate (scaffolded) |

## Quickstart

Prerequisites: Node 20+, pnpm 9+, Python 3.11+, Xcode 15+ (optional, for iOS).

```bash
git clone https://github.com/lawoflarge/rateradar.git
cd rateradar
pnpm install

# Web (http://localhost:3000)
cd apps/web
cp .env.local.example .env.local   # if you have Supabase creds; otherwise mock data flows
pnpm dev

# Data pipeline (stdout only by default)
cd ../../services/data-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main --bank fed --source mock          # Fed
python -m src.main --bank ecb --source mock          # ECB
python -m src.main --bank fed --source mock --write  # write to Supabase (needs RR_DB_URL)

# Pipeline tests
pytest
```

## Tests

| Suite | Count | Status |
| --- | --- | --- |
| Pipeline (`services/data-pipeline/tests`) | 31 | ✅ passing |
| Probability math (pure) | 14 | ✅ |
| Fed fetcher (integration w/ mock) | 7 | ✅ |
| ECB fetcher (integration w/ mock) | 5 | ✅ |
| Supabase writer | 5 | ✅ |

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for:
- Vercel env vars and auto-deploy setup (already live)
- Three pipeline-hosting options (Fly.io, Railway, GitHub Actions cron)
- Activating real market data (Polygon.io / Alpha Vantage / Stooq API key)
- iOS build + TestFlight steps

## Methodology + data sources

Every probability on the site is **computed in-house** from free futures /
OIS prices, using the public CME step-function decomposition. We don't
scrape CME or ECB Watch. See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for
the full calculation, validation rules, and known MVP limitations.

## License

Proprietary during pre-launch (see `LICENSE`). Likely MIT after public release.

## Not financial advice

RateRadar shows what the market is pricing. It does not predict what central
banks will actually decide. Nothing here is a recommendation to trade, invest,
or change your financial plans.
