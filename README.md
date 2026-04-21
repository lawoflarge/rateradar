# RateRadar

> See where rates are headed — before the meeting.

A modern, mobile-first tracker for Fed and ECB interest-rate decisions, with **historical probability tracking** — the feature every other tool is missing.

## What makes this different

CME FedWatch and ECB Watch both show the *current* market-implied probability of rate decisions — but neither tells you **how those probabilities moved over the last day, week, or month**. RateRadar does.

- 📊 Full Fed + ECB coverage in one place
- 📈 Historical probability charts with event overlays (CPI, NFP, speeches)
- 🔔 Probability-shift alerts (iOS push, home-screen widgets)
- 🤝 Shareable chart cards for social
- 🧠 Plain-English explainers — no Bloomberg terminal required
- 📱 Native iOS app + web

## Status

Pre-launch. Building now. See [docs/PRD.md](docs/PRD.md) for the full product spec and [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for how probabilities are calculated.

## Repository layout

```
rateradar/
├── apps/
│   ├── web/                 # Next.js 14 App Router (TypeScript, Tailwind, shadcn/ui)
│   └── ios/                 # Swift + SwiftUI (iOS 17+, Swift Charts)
├── services/
│   └── data-pipeline/       # Python — yfinance + pandas + Supabase writes
├── packages/
│   └── api-contract/        # OpenAPI schema, generated TS + Swift models
├── infra/
│   └── supabase/            # Postgres schema migrations, RLS policies
├── docs/                    # PRD, methodology, architecture
└── .github/workflows/       # CI: lint, test, build, deploy
```

## Quickstart (for contributors)

Prerequisites: Node 20+, pnpm, Python 3.11+, Xcode 15+ (iOS), a Supabase project.

```bash
# Install workspace dependencies
pnpm install

# Set up env vars
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.

# Run data pipeline once (populates Supabase with today's snapshot)
cd services/data-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main --bank fed --once

# Run web
cd ../../apps/web
pnpm dev

# Run iOS app
open ../ios/RateRadar.xcodeproj
```

## Data source & legal

All probabilities are **computed in-house** using the public CME methodology, from freely available futures prices (via `yfinance` for Fed Funds Futures, `stooq.com` for €STR OIS). No CME or ECB Watch data is scraped or republished. See [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Revenue

Ad-supported (Google AdSense on web, AdMob on iOS) + broker affiliate partnerships. A Pro tier is planned for post-launch.

## License

TBD — private during development.
