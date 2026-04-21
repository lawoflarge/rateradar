-- RateRadar initial schema
-- Migration: 0001_initial
-- Purpose: core tables for Fed + ECB meeting probability tracking with history

create extension if not exists "pgcrypto";

---------------------------------------------------------------------
-- central_banks: FED, ECB (extensible for BoE, BoJ later)
---------------------------------------------------------------------
create table public.central_banks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.central_banks (code, name) values
  ('FED', 'Federal Reserve'),
  ('ECB', 'European Central Bank');

---------------------------------------------------------------------
-- meetings: each scheduled FOMC / ECB Governing Council meeting
---------------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.central_banks(id) on delete cascade,
  meeting_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (bank_id, meeting_date)
);

create index idx_meetings_bank_date on public.meetings (bank_id, meeting_date);

---------------------------------------------------------------------
-- outcomes: possible rate-change outcomes for each meeting
-- e.g., "Hold", "-25bp", "+25bp", "-50bp"
---------------------------------------------------------------------
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  label text not null,
  delta_bps integer not null,   -- 0 = hold, -25 = cut, +25 = hike, etc.
  created_at timestamptz not null default now(),
  unique (meeting_id, delta_bps)
);

create index idx_outcomes_meeting on public.outcomes (meeting_id);

---------------------------------------------------------------------
-- probability_snapshots: the historical record — our differentiator
---------------------------------------------------------------------
create table public.probability_snapshots (
  outcome_id uuid not null references public.outcomes(id) on delete cascade,
  snapshot_at timestamptz not null,
  probability numeric(6,4) not null check (probability >= 0 and probability <= 1),
  source text not null default 'pipeline',   -- 'pipeline', 'backfill', 'manual'
  primary key (outcome_id, snapshot_at)
);

-- Core query index: pull recent history for an outcome
create index idx_snapshots_outcome_time on public.probability_snapshots (outcome_id, snapshot_at desc);

-- Secondary index for "all snapshots at time T" queries
create index idx_snapshots_time on public.probability_snapshots (snapshot_at desc);

---------------------------------------------------------------------
-- events: macro releases and speeches that may explain chart moves
-- rendered as pin/annotation on historical probability chart
---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references public.central_banks(id) on delete set null,
  date date not null,
  kind text not null check (kind in (
    'cpi', 'ppi', 'nfp', 'unemployment', 'gdp',
    'fomc_minutes', 'ecb_speech', 'fed_speech',
    'jolts', 'retail_sales', 'other'
  )),
  title text not null,
  description text,
  source_url text,
  created_at timestamptz not null default now()
);

create index idx_events_bank_date on public.events (bank_id, date desc);
create index idx_events_date on public.events (date desc);

---------------------------------------------------------------------
-- users: reserved for future Pro tier. No use in MVP.
---------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now(),
  tier text not null default 'free' check (tier in ('free', 'pro'))
);

---------------------------------------------------------------------
-- Row Level Security
-- MVP policy: all reads public (product is ad-supported, free tier).
-- Writes restricted to service role only (pipeline).
---------------------------------------------------------------------
alter table public.central_banks enable row level security;
alter table public.meetings enable row level security;
alter table public.outcomes enable row level security;
alter table public.probability_snapshots enable row level security;
alter table public.events enable row level security;
alter table public.users enable row level security;

create policy "public read banks" on public.central_banks
  for select using (true);
create policy "public read meetings" on public.meetings
  for select using (true);
create policy "public read outcomes" on public.outcomes
  for select using (true);
create policy "public read snapshots" on public.probability_snapshots
  for select using (true);
create policy "public read events" on public.events
  for select using (true);
-- users table has no public read — reserved for Pro tier

---------------------------------------------------------------------
-- Convenience view: latest snapshot per outcome
---------------------------------------------------------------------
create or replace view public.latest_probabilities as
select distinct on (o.id)
  o.id           as outcome_id,
  o.meeting_id,
  o.label,
  o.delta_bps,
  m.bank_id,
  m.meeting_date,
  ps.probability,
  ps.snapshot_at
from public.outcomes o
join public.meetings m on m.id = o.meeting_id
left join public.probability_snapshots ps on ps.outcome_id = o.id
order by o.id, ps.snapshot_at desc;
