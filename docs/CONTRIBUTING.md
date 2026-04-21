# Contributing to RateRadar

## Prerequisites

- Node 20+ and pnpm 9+
- Python 3.11+
- Xcode 15+ (for iOS work)
- A Supabase project (free tier is plenty)

## Setup

```bash
git clone https://github.com/lawoflarge/rateradar.git
cd rateradar
pnpm install
cp .env.example .env   # fill in your values
```

For the data pipeline:

```bash
cd services/data-pipeline
python -m venv .venv
source .venv/bin/activate      # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
pytest
```

For iOS:

```bash
open apps/ios/RateRadar.xcodeproj
```

## Working on a change

1. Create a branch: `git checkout -b feat/my-change`
2. Write tests first when touching the data pipeline (probability math must stay correct)
3. Make your change
4. Run lint + tests: `pnpm lint && pnpm test` and `pytest` in `services/data-pipeline`
5. Commit with [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`
6. Open a PR

## What we look for in a PR

- **Clear scope.** One concern per PR. If you find a bug while working on a feature, file an issue or separate it.
- **Tests when it matters.** Probability math: mandatory. UI tweaks: nice to have.
- **Updated docs.** If you change methodology, update `docs/METHODOLOGY.md` in the same PR.
- **No secrets.** Never commit `.env`, API keys, Supabase service-role keys, or APNs private keys.

## Code style

- **TypeScript:** strict mode, no `any`. Zod at boundaries.
- **Python:** `black` + `ruff`. Type annotations everywhere.
- **Swift:** SwiftUI only (no UIKit unless forced). `@Observable` state.

## Questions

Open a GitHub discussion or issue. For sensitive matters, email the maintainer.
