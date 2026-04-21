# RateRadar — Handover

**Last session:** 2026-04-21
**Status:** MVP implementation complete. Live at <https://rateradar-web.vercel.app>.
**Remaining work:** external-account activations (API keys, Apple Developer) — no more autonomous coding blocked.

If you are Claude (or another agent) picking this up in a new chat: read this
document in full before touching anything. It gives you the whole state in
one place so you don't have to rebuild context from commits.

---

## TL;DR — what RateRadar is

A modern Fed + ECB interest-rate decision probability tracker. Fills three
gaps in CME FedWatch and ECB Watch:
1. Historical probability charts (60 days per meeting)
2. Unified Fed + ECB coverage
3. Modern mobile-first UX with shareable OG images

All probabilities are computed in-house using the public CME step-function
methodology — we don't scrape. Monetization: AdSense + AdMob + broker
affiliates. Pro tier deferred to post-MVP.

Full product spec in [`docs/PRD.md`](PRD.md). Math in
[`docs/METHODOLOGY.md`](METHODOLOGY.md). System design in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Live surfaces

| Surface | URL | Status |
| --- | --- | --- |
| Web | https://rateradar-web.vercel.app | ✅ Live, auto-deploys from `main` |
| API | https://rateradar-web.vercel.app/api/* | ✅ Reads from Supabase |
| Status probe | https://rateradar-web.vercel.app/api/status | ✅ |
| GitHub repo | https://github.com/lawoflarge/rateradar | ✅ Private, CI green |
| Supabase project | nzuovghfjxnbnraxxkej (eu-central-1) | ✅ Schema + seed + 60d history applied |
| iOS app | `apps/ios/` scaffold | ⏸ Scaffold only — needs Xcode on a Mac |
| Data pipeline | Python in `services/data-pipeline/` | ✅ `--write` works; ⏸ not scheduled yet |
| Custom domain | rateradar.com (squatted since 2005) | ⏸ Launch on .vercel.app; negotiate/buy later |

---

## Local machine state (Windows)

Paths you'll need:

```
C:\Users\levin\rateradar\           Local repo, main branch
C:\Users\levin\.rr_gh_token         GitHub PAT (gitignored)
C:\Users\levin\.rr_db_url           Supabase Postgres URL with password
```

Node, pnpm, Python, git all installed. pnpm was installed globally via
`npm install -g pnpm@9` (corepack was blocked by Program Files permissions).

Git is configured with credential helper that reads from `~/.rr_gh_token`:
```
git config credential.https://github.com.helper "!f() { echo username=x-access-token; echo password=\$(cat /c/Users/levin/.rr_gh_token); }; f"
```

No special env vars needed for web dev — Supabase creds are in
`apps/web/.env.local` (gitignored).

---

## Repository layout

```
rateradar/
├── apps/
│   ├── web/                 Next.js 16 + React 19 + Tailwind 4 + Recharts
│   │   ├── src/app/         Routes: /, /meeting/[id], /compare, /methodology,
│   │   │                    /glossary, /brokers, /about, /api/[bank]/probabilities,
│   │   │                    /api/meetings/[id]/history, /api/og/meeting/[id],
│   │   │                    /api/status, /sitemap.xml, /robots.txt
│   │   ├── src/components/  NavBar, ProbabilityTable, HistoricalChart,
│   │   │                    MeetingCountdown, MostLikelyPath, ImpliedRateCurve,
│   │   │                    MeetingContext, ShareButtons
│   │   ├── src/lib/         data.ts (core fetchers), supabase.ts, types.ts,
│   │   │                    mock-data.ts, analytics.ts, policy-rates.ts
│   │   └── .env.local       NEXT_PUBLIC_SUPABASE_URL + publishable key
│   └── ios/                 SwiftUI scaffold
│       ├── project.yml      XcodeGen spec
│       ├── README.md        How to generate the Xcode project
│       └── RateRadar/       Source: App, Views, Services, Models, Resources
├── services/
│   └── data-pipeline/       Python 3.11
│       ├── src/
│       │   ├── probability_calc.py   Pure math (no I/O)
│       │   ├── fed_fetcher.py        Fed orchestrator
│       │   ├── ecb_fetcher.py        ECB orchestrator
│       │   ├── supabase_writer.py    DB upsert (isolated I/O)
│       │   ├── main.py               CLI entrypoint
│       │   ├── fetchers/             PriceFetcher protocol + implementations
│       │   │                         (MockFetcher, YFinanceFetcher,
│       │   │                         EcbMockFetcher)
│       │   └── calendars/            fed_2026.yaml, fed_2027.yaml, ecb_2026.yaml
│       ├── tests/           31 passing pytest tests
│       ├── Dockerfile
│       ├── fly.toml
│       ├── railway.json
│       ├── requirements.txt
│       └── pyproject.toml
├── packages/
│   └── api-contract/openapi.yaml     OpenAPI 3.1 shared schema
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20260421000000_initial.sql
├── scripts/                 One-shot DB helpers
│   ├── apply_migration.py   Direct-connection migration runner
│   ├── seed_supabase.py     Central banks + meetings + outcomes + today's snapshot
│   └── seed_history.py      60 days of plausible historical snapshots
├── docs/
│   ├── PRD.md
│   ├── METHODOLOGY.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── CONTRIBUTING.md
│   └── HANDOVER.md          ← you are here
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           Lint + build on every PR/push (green on main)
│   │   └── pipeline-cron.yml Scheduled pipeline runs (needs RR_DB_URL secret)
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── .mcp.json                Project-scope Supabase MCP server
├── CLAUDE.md                Project-specific agent guidance
├── LICENSE                  Proprietary placeholder
├── README.md
├── package.json             Root: pnpm@9.0.0 packageManager
├── pnpm-workspace.yaml      Workspaces: apps/*, packages/*
└── turbo.json               Turborepo pipeline config
```

---

## Supabase state (production)

Schema: `supabase/migrations/20260421000000_initial.sql`

Tables:
- `central_banks` (FED, ECB)
- `meetings` (bank_id, meeting_date, status) — 24 rows
- `outcomes` (meeting_id, label, delta_bps) — 120 rows (5 per meeting)
- `probability_snapshots` (outcome_id, snapshot_at, probability, source) — ~6820 rows (mix of seed, history-seed, and pipeline sources)
- `events` (macro events for chart overlays) — empty
- `users` (reserved for Pro tier) — empty

Row Level Security: reads public on all tables except `users`; writes are
service-role-only (pipeline) for everything.

There's a `public.latest_probabilities` view that joins outcomes + latest
snapshots — used by the web app's data layer.

### How to run SQL against prod

```bash
# Read the URL from the gitignored file — never echo the password
export RR_DB_URL="$(cat /c/Users/levin/.rr_db_url)"
python scripts/apply_migration.py supabase/migrations/<file>.sql
```

The URL points to the Supavisor pooler:
`aws-1-eu-central-1.pooler.supabase.com:6543` with user
`postgres.nzuovghfjxnbnraxxkej`. Direct connection on port 5432 is IPv6-only
and less reliable from Windows.

---

## Web (Next.js 16 + React 19)

**Deploy target:** Vercel project `rateradar-web` in team
`lawoflarges-projects`. Root dir `apps/web`. Auto-deploys from `main`.

**Env vars on Vercel** (already set):
```
NEXT_PUBLIC_SUPABASE_URL=https://nzuovghfjxnbnraxxkej.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GIlEA3a--RsV79j4E-B9PQ_2nlaov4g
```

Optional (activate when ready):
```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...
```

**Key implementation notes:**
- Data layer (`apps/web/src/lib/data.ts`) falls back to mock data when
  Supabase is unconfigured or errors — keeps CI + preview deploys working
  without secrets.
- `/compare`, `/`, and `/meeting/[id]` use `export const revalidate = 300`
  for 5-min ISR.
- Meeting IDs are globally unique UUIDs; `/api/meetings/[id]/history` is
  bank-agnostic.
- OG images are generated dynamically via `next/og` (Satori). `/api/og/meeting/[id]`
  returns 1200x630 PNG.
- React 19's `react-hooks/purity` rule bans mutable counters during render —
  use `reduce()` instead of `let` accumulators in Server Components.
- NavBar is in `layout.tsx`, so every page gets the same nav.

---

## iOS (`apps/ios/`)

**Scaffold only — not built.** On a Mac with Xcode 15+:
```bash
brew install xcodegen
cd apps/ios
xcodegen generate
open RateRadar.xcodeproj
```

The project.yml targets iOS 17, uses Swift 5.10 strict concurrency, bundle ID
`com.lawoflarge.rateradar`. Override the API host for local dev with the
`RATERADAR_API_HOST` environment variable in the scheme.

Scaffolded views:
- `App.swift` — @main entry, dark color scheme
- `HomeView.swift` — dashboard with Fed + ECB sections
- `MeetingDetailView.swift` — detail + native ShareLink
- `HistoricalChartView.swift` — Swift Charts LineMark per outcome
- `ProbabilityTableView.swift` — outcome rows with colored bars

TODO post-scaffold: widgets, push, complications, TestFlight submission.

---

## Data pipeline (`services/data-pipeline/`)

```bash
cd services/data-pipeline
python -m venv .venv && source .venv/bin/activate    # on Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Print probabilities (no DB write)
python -m src.main --bank fed --source mock
python -m src.main --bank ecb --source mock

# Persist snapshots to Supabase
export RR_DB_URL="$(cat /c/Users/levin/.rr_db_url)"
python -m src.main --bank fed --source mock --write

# Tests
pytest
```

31 tests pass in ~2s. All math is pure (no I/O in `probability_calc.py` /
`fed_fetcher.py` / `ecb_fetcher.py`). I/O is isolated in
`supabase_writer.py` and the `fetchers/` module.

### Adding a real data source

1. Create `services/data-pipeline/src/fetchers/polygon_source.py` (or
   alphavantage, stooq-paid, etc.) implementing the `PriceFetcher` protocol.
2. Register in `main.py::build_fetcher()`.
3. Store the provider's API key as a secret wherever the pipeline runs
   (GitHub Actions → repo secrets; Fly → `fly secrets set`; Railway → env).
4. Flip the scheduled command from `--source mock` to `--source <provider>`.

Fed: need 30-Day Fed Funds Futures (ZQ) prices for ~8-12 contract months.
ECB: need €STR OIS forward curves. Most free tiers (Polygon 5/min, Alpha
Vantage 25/day) are enough for a daily cadence.

### Scheduled runs

Three options (all scaffolded, pick one):
- `.github/workflows/pipeline-cron.yml` — free, needs `RR_DB_URL` repo secret
- `services/data-pipeline/fly.toml` — Fly.io scheduled machines (Frankfurt region)
- `services/data-pipeline/railway.json` — Railway (dashboard scheduling)

See `docs/DEPLOYMENT.md` for step-by-step.

---

## What's done vs what's left

### Done (tasks 11-32)
- Fed data fetcher + ECB data fetcher + mock sources + YFinance fallback
- 2026-2027 FOMC + 2026 ECB meeting calendars (YAML)
- End-to-end probability calc (31 passing tests)
- Supabase schema + seed + 60d history seeding scripts
- Supabase writer (pipeline `--write` flag)
- Next.js web app: homepage, meeting detail, compare, methodology, glossary,
  brokers, about, sitemap, robots
- Historical probability charts (Recharts), implied rate curves,
  most-likely-path visualization, meeting path context
- Dynamic OG images + Twitter/LinkedIn/copy share buttons
- SEO (ISR, canonicals, structured metadata)
- iOS scaffold (XcodeGen + all SwiftUI source files)
- CI green (web + pipeline)
- Error boundary, loading skeleton, not-found page, PostHog scaffold
- `/api/status` health endpoint
- Three pipeline hosting configs (GitHub Actions cron, Fly.io, Railway)
- Full deployment guide
- README rewrite

### Deferred (need user action to start)
- **Live market data provider** (task 16) — Polygon.io / Alpha Vantage / paid Stooq
- **Pipeline scheduling activation** — add `RR_DB_URL` to GitHub Actions secrets
- **AdSense account** — 1-2 week approval
- **Apple Developer Program** + TestFlight + App Store submission
- **Broker affiliate programs** (IBKR, eToro, Trading212, Plus500) — replace placeholders in `/brokers`
- **Custom domain** — rateradar.com is squatted; either negotiate/buy or pivot TLD

### Deferred (non-blocking enhancements for future sessions)
- True CME-style conditional probabilities (needs contract-price persistence
  + cross-contract anchoring — see `docs/METHODOLOGY.md §10`)
- Push notifications for probability-shift alerts (iOS)
- WidgetKit home-screen widgets
- Apple Watch complication
- Weekly newsletter + sponsor slots
- Android app
- Embeddable chart widgets for third-party blogs
- Chain-of-thought improvements for late-month-meeting math
- Historical article content (SEO: "how Fed expectations shifted during 2022")

---

## Picking up in a new chat

1. **Start here:** Read this file + `CLAUDE.md` + `docs/PRD.md` first. Don't
   rebuild context from commits.

2. **Verify live state:**
   ```bash
   curl https://rateradar-web.vercel.app/api/status
   ```
   Should return `ok: true` with meeting/outcome/snapshot counts.

3. **Run the web app locally** to confirm nothing drifted:
   ```bash
   cd C:\Users\levin\rateradar\apps\web
   pnpm install   # should be a noop
   pnpm dev
   # visit http://localhost:3000
   ```

4. **Run the pipeline tests** to confirm Python env still works:
   ```bash
   cd C:\Users\levin\rateradar\services\data-pipeline
   pytest
   # 31 passed
   ```

5. **Check CI:**
   ```bash
   curl -s -H "Authorization: Bearer $(cat /c/Users/levin/.rr_gh_token)" \
     https://api.github.com/repos/lawoflarge/rateradar/actions/runs?per_page=3 \
     | python -c "import json,sys; d=json.load(sys.stdin); [print(r['head_sha'][:7], r['conclusion']) for r in d['workflow_runs']]"
   ```

6. **Pick a task from "Deferred" above** based on what the user wants next.
   Most of them have been designed so the code is already in place — you
   just plug in a key or toggle a flag.

---

## Decisions made and why

- **Name:** RateRadar — user picked from a short list. `.com` squatted;
  launched on `rateradar-web.vercel.app` to ship fast.
- **Stack:** Next.js 16 + native Swift (user picked "proper" native iOS over
  React Native).
- **Data:** Compute probabilities in-house from free futures prices (no
  scraping CME/FedWatch, keeping App Store risk at zero).
- **Monetization:** Ads + affiliate for MVP; Pro tier deferred until traffic
  justifies it.
- **Audience:** Retail traders primary, finance-curious students secondary.
- **Conditional probabilities:** Skipped true math (needs contract-price
  persistence); shipped the practical version (Prior/Next meeting mini-cards)
  that achieves 80% of the UX value without new data.
- **Late-month-meeting math** is simplified for MVP and produces noisy
  outputs for meetings in the final 5 days of a month. Documented in
  `docs/METHODOLOGY.md §10`. Production fix uses CME's cross-contract
  anchoring; not shipped yet.

---

## Gotchas / lessons

- **React 19 purity rule:** Server Components can't mutate `let` variables
  during render. Use `reduce()` or another pure pattern.
- **pnpm/action-setup@v4:** If package.json has a `packageManager` field,
  don't also pass `version:` — it errors with "Multiple versions specified".
- **Recharts ResponsiveContainer** logs a harmless "width(-1) and height(-1)"
  warning during SSR static generation. Cosmetic; ignore.
- **yfinance rate limits** aggressively. Use as fallback only; primary data
  source should be a registered API.
- **Supabase direct connection (port 5432)** is IPv6-only on the default
  `db.<ref>.supabase.co` host. Prefer the Supavisor pooler on port 6543 with
  user `postgres.<ref>` for IPv4 compatibility from Windows.
- **Windows cp1252 terminal** can't print Unicode box-drawing characters.
  Use ASCII in CLI output (`--`, `|`, `+`).

---

## Repo hygiene

- CLI runs, tests, and builds are all one-shot commands — no state outside
  the repo, the gitignored local token files, and Supabase.
- `.env.local` in `apps/web/` contains real Supabase creds; gitignored.
- Don't commit: `apps/web/.env.local`, `C:\Users\levin\.rr_*` files, any
  Supabase service-role keys, Apple keys, AdSense IDs.
- Conventional commits: `feat(web):`, `fix(ci):`, `docs:`, etc. CI runs on
  every push to `main`.

Good luck. The ball is in the user's court for external account activations.
When they're ready, the code is already waiting.
