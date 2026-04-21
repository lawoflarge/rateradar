# Deployment

How to get RateRadar running in production. Three surfaces to deploy:
the Next.js web app (Vercel), the Python data pipeline (Fly.io / Railway /
GitHub Actions), and the iOS app (TestFlight / App Store).

## 1. Web (Next.js) → Vercel

Already set up. Auto-deploys from `main`:

- Vercel project: `rateradar-web` in team `lawoflarges-projects`
- Root directory: `apps/web`
- Build command: `turbo run build`
- Install command: `pnpm install`
- Env vars to set in Vercel → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://nzuovghfjxnbnraxxkej.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # the one in .env.local
```

Optional (for analytics, once configured):

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...
```

Live URL: <https://rateradar-web.vercel.app>

## 2. Data pipeline (Python)

The pipeline reads market data, computes probabilities, and writes
snapshots to Supabase. It needs to run twice per business day (after US
and European closes) and every 15 minutes on meeting days.

### Option A — GitHub Actions cron (free, easiest)

Already scaffolded in `.github/workflows/pipeline-cron.yml`.

1. Add `RR_DB_URL` to GitHub Actions secrets (repo Settings → Secrets and
   variables → Actions → New repository secret). Value: the Supabase
   Postgres connection string with password.
2. Optionally enable the workflow by adding an empty commit — GitHub
   disables scheduled workflows after 60 days of inactivity; keep the repo
   alive.

Limits: GitHub cron is not minute-precise and can run up to 30 min late.
Fine for daily snapshots; consider a dedicated host for meeting-day
sub-minute refreshes.

### Option B — Fly.io scheduled machines (best for sub-minute precision)

```bash
cd services/data-pipeline
fly auth login
fly launch --no-deploy --name rateradar-pipeline --copy-config
fly secrets set RR_DB_URL="postgresql://postgres.nzuovghfjxnbnraxxkej:PWD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"
fly deploy

# Schedule:
fly machines run --schedule hourly --region fra rateradar-pipeline \
  "python -m src.main --bank fed --source mock --write"
fly machines run --schedule hourly --region fra rateradar-pipeline \
  "python -m src.main --bank ecb --source mock --write"
```

Fly free tier: 3 shared-CPU 256MB machines, more than enough for this.

### Option C — Railway

```bash
railway login
railway link    # or: railway init
railway up --path services/data-pipeline
railway variables set RR_DB_URL="postgresql://..."
```

Add a scheduled task via Railway's dashboard; pick cron expressions matching
the GitHub Actions schedule.

### Real data source

The pipeline ships with mock data by default so it can run without any API
keys. To use real data:

1. Pick a provider: **Polygon.io** (free tier 5 req/min), **Alpha Vantage**
   (free tier 25/day), or **Stooq API** (paid, stable).
2. Implement a new `PriceFetcher` subclass in
   `services/data-pipeline/src/fetchers/` following the shape of
   `MockFetcher`. Fetch the contract prices (for Fed: ZQ front-month + next
   several months; for ECB: €STR OIS curve).
3. Add the provider as an option in `main.py::build_fetcher` behind a
   `--source <provider>` flag.
4. Set its API key as a secret in whichever deployment target you picked
   (Fly/Railway/GitHub Actions).
5. Flip the scheduled command from `--source mock` to `--source <provider>`.

## 3. iOS (coming soon)

The `apps/ios` folder contains the SwiftUI scaffold. Build and ship via
Xcode Cloud or Fastlane → TestFlight → App Store. Requires:

- Apple Developer Program membership ($99/yr)
- Bundle ID registration (`com.lawoflarge.rateradar`)
- App Store Connect app record
- APNs key for push notifications (if enabled)

## 4. Supabase

Already live at `nzuovghfjxnbnraxxkej`. Migration + seed scripts live in
`supabase/migrations/` and `scripts/`; apply them with
`scripts/apply_migration.py` (reads `RR_DB_URL` env). For production
maintenance, prefer the Supabase CLI (`supabase db push`) once
authenticated.
