# RateRadar

> See where rates are headed — before the meeting.

A modern, mobile-first tracker for **Fed and ECB** interest-rate decisions with
**historical probability charts** — the feature neither CME FedWatch nor
ECB Watch ship today.

[![CI](https://github.com/lawoflarge/rateradar/actions/workflows/ci.yml/badge.svg)](https://github.com/lawoflarge/rateradar/actions/workflows/ci.yml)
[![Pipeline cron](https://github.com/lawoflarge/rateradar/actions/workflows/pipeline-cron.yml/badge.svg)](https://github.com/lawoflarge/rateradar/actions/workflows/pipeline-cron.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live:** <https://rateradar-web.vercel.app>
**iOS:** [App Store](https://apps.apple.com/app/id6768628917)

---

## What makes RateRadar different

- **Full Fed + ECB coverage in one place.** Not two disconnected sites.
- **60 days of historical probability charts** per meeting, color-coded by outcome — see exactly how expectations moved into each decision.
- **Cumulative pricing headline** (Σ pᵢ · Δᵢ) — the single number that matters.
- **Implied forward rate curve** per bank and a side-by-side **Fed-vs-ECB divergence view**.
- **Snapshot history in git.** Every cron run commits a JSON snapshot to `services/data-pipeline/snapshots/` and a derived content bundle to `content/` — the historical record is reproducible from the repo itself, not lost behind a paused database.
- **Diff engine.** After each snapshot the pipeline runs `src.diff_engine` against `actuals.json` to compute hit-rates, biggest misses, and a public scoreboard (`content/scoreboard.json`).
- **Deep-linkable meeting pages** with dynamic Open Graph images (Twitter, LinkedIn, iMessage unfurl).
- **Plain-English glossary** + a transparent methodology page — every number on the site is derived from the math documented in [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).
- **Native iOS app** on the App Store (Expo + WebView wrapper, banner ads opt-in via env flag).

## Why not just scrape CME FedWatch?

We don't. Every probability shown on RateRadar is **computed in-house** from
free futures / OIS prices, using the public CME step-function decomposition.
That's a deliberate constraint — legal, App Store, and trust all benefit from
not republishing somebody else's UI. See
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for the full calculation, validation
rules, and known MVP limitations.

## Repository layout

```
rateradar/
├── apps/
│   ├── web/                 # Next.js 16 + React 19 + Tailwind 4 + Recharts
│   ├── ios-expo/            # Expo SDK 54 WebView wrapper — the App Store build
│   └── ios/                 # SwiftUI + Swift Charts native scaffold (XcodeGen)
├── services/
│   └── data-pipeline/       # Python: fetch → probability_calc → diff → write
│       ├── src/             # probability_calc.py is pure; I/O is isolated
│       ├── snapshots/       # cron-committed JSON snapshots (source of truth)
│       └── tests/           # 30+ pytest tests
├── content/                 # derived: meeting briefs, embed SVGs, scoreboard.json
├── packages/api-contract/   # OpenAPI 3.1 schema shared by web + iOS
├── supabase/migrations/     # Postgres schema with RLS
├── scripts/                 # one-shot migration + seed runners
├── docs/                    # PRD, METHODOLOGY, ARCHITECTURE, DEPLOYMENT, CONTRIBUTING
├── .github/workflows/       # CI (lint/test/build) + twice-daily pipeline cron
├── codemagic.yaml           # iOS production build → TestFlight
└── CLAUDE.md                # guidance for AI assistants editing this repo
```

## Stack at a glance

| Surface | Tech |
| --- | --- |
| Web | Next.js 16 App Router, React 19, Tailwind 4, shadcn-style UI, Recharts |
| iOS (App Store) | Expo SDK 54, React Native, WebView, EAS Build, Codemagic CI |
| iOS (native scaffold) | SwiftUI, Swift Charts, Observation framework, async/await |
| Data pipeline | Python 3.11, pandas, yfinance, tenacity, psycopg2 |
| Database | Supabase Postgres with Row Level Security |
| API contract | OpenAPI 3.1 |
| Hosting | Vercel (web), GitHub Actions cron (pipeline) |
| Analytics | PostHog (scaffolded, env-gated) |
| Ads | Google AdSense (web), AdMob (iOS) — both env-gated |

## Quickstart

Prerequisites: Node 20+, pnpm 9+, Python 3.11+. Xcode 15+ optional for the iOS scaffold.

```bash
git clone https://github.com/lawoflarge/rateradar.git
cd rateradar
pnpm install

# Web (http://localhost:3000) — works without Supabase via mock-data fallback
cd apps/web
cp .env.example .env.local           # fill in your Supabase keys to use real data
pnpm dev

# Data pipeline (stdout only by default)
cd ../../services/data-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main --bank fed --source mock
python -m src.main --bank ecb --source mock
python -m src.main --bank fed --source mock --write   # writes to Supabase (needs RR_DB_URL)

# Pipeline tests
pytest
```

## Tests

| Suite | Status |
| --- | --- |
| Pipeline (`services/data-pipeline/tests`) | green |
| Probability math (pure) | green |
| Fed + ECB fetchers (mock integration) | green |
| Supabase writer | green |
| Web (Next.js lint + build) | green on `main` |

## Pipeline cron

`.github/workflows/pipeline-cron.yml` runs twice every weekday (18:00 and 22:00 UTC):

1. Fetches futures / OIS prices for Fed and ECB.
2. Computes probabilities (pure functions, fully unit-tested).
3. Writes a JSON snapshot to `services/data-pipeline/snapshots/{fed,ecb}/`.
4. Best-effort upserts to Supabase (skipped silently if the project is paused).
5. Runs `src.diff_engine` to score recent snapshots against `actuals.json` and refresh the content bundle.
6. Commits the snapshots and derived content back to `main`.

The JSON snapshots are the source of truth — history survives even if the
Supabase free-tier project is paused.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for:
- Vercel env vars and auto-deploy setup
- Three pipeline-hosting options (GitHub Actions cron, Fly.io, Railway)
- Activating real market data (Polygon.io / Alpha Vantage / Stooq API key)
- iOS build + TestFlight steps via Codemagic

## Contributing

PRs welcome. See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the workflow,
commit convention, and the non-negotiables (in-house probabilities, methodology
transparency, no scraping).

## License

[MIT](LICENSE) © Levin Schwab.

## Not financial advice

RateRadar shows what the market is pricing. It does not predict what central
banks will actually decide. Nothing here is a recommendation to trade, invest,
or change your financial plans.
