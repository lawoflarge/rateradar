"""Seed Supabase with Fed + ECB meetings and their standard outcome sets.

Reads YAML calendars from services/data-pipeline/src/calendars/ and writes
meetings + outcomes to Supabase. Idempotent — safe to re-run.

Also inserts a single mock probability snapshot per outcome so the web app has
something to render before the live pipeline is running. This mock snapshot is
labeled `source = 'seed'` so we can distinguish it from pipeline data later.

Usage:
    export RR_DB_URL="postgresql://postgres.<project_ref>:<password>@..."
    python scripts/seed_supabase.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CALENDAR_DIR = REPO_ROOT / "services" / "data-pipeline" / "src" / "calendars"

# Standard outcome set: Hold + symmetric 25bp / 50bp moves either direction
STANDARD_OUTCOMES = [
    ("-50bp", -50),
    ("-25bp", -25),
    ("Hold", 0),
    ("+25bp", 25),
    ("+50bp", 50),
]

# Plausible Apr-2026 probability snapshot: rates held, gradual easing priced for H2
# Keyed by delta_bps so we can match each meeting's outcomes consistently
MOCK_PROBS_NEAR = {-50: 0.02, -25: 0.18, 0: 0.75, 25: 0.05, 50: 0.00}
MOCK_PROBS_MID = {-50: 0.05, -25: 0.55, 0: 0.38, 25: 0.02, 50: 0.00}
MOCK_PROBS_FAR = {-50: 0.15, -25: 0.45, 0: 0.37, 25: 0.03, 50: 0.00}


def pick_mock_probs(meeting_date: str, today_iso: str) -> dict[int, float]:
    """Pick one of three mock probability profiles based on how far out the meeting is."""
    days = (
        datetime.fromisoformat(meeting_date).replace(tzinfo=timezone.utc)
        - datetime.fromisoformat(today_iso).replace(tzinfo=timezone.utc)
    ).days
    if days < 0:
        return MOCK_PROBS_NEAR  # past meetings — treat as held
    if days < 60:
        return MOCK_PROBS_NEAR
    if days < 180:
        return MOCK_PROBS_MID
    return MOCK_PROBS_FAR


def load_calendar(filename: str) -> dict:
    path = CALENDAR_DIR / filename
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def seed(conn) -> None:
    with conn.cursor() as cur:
        # 1. central_banks should already exist from migration; verify
        cur.execute("select code, id from public.central_banks")
        banks = {row[0]: row[1] for row in cur.fetchall()}
        if "FED" not in banks or "ECB" not in banks:
            raise RuntimeError(f"Expected FED and ECB in central_banks; found {list(banks)}")
        print(f"  central banks: {list(banks)}")

        # 2. meetings: insert (idempotent via unique constraint on bank_id + date)
        calendars = [
            ("fed_2026.yaml", banks["FED"]),
            ("fed_2027.yaml", banks["FED"]),
            ("ecb_2026.yaml", banks["ECB"]),
        ]
        total_meetings = 0
        for filename, bank_id in calendars:
            cal = load_calendar(filename)
            for entry in cal["meetings"]:
                cur.execute(
                    """
                    insert into public.meetings (bank_id, meeting_date, status)
                    values (%s, %s, %s)
                    on conflict (bank_id, meeting_date) do nothing
                    """,
                    (bank_id, entry["date"], entry.get("status", "scheduled")),
                )
                total_meetings += 1
        print(f"  meetings seeded: {total_meetings} upsert attempts")

        # 3. outcomes: 5 per meeting
        cur.execute("select id, meeting_date from public.meetings")
        meetings = cur.fetchall()
        total_outcomes = 0
        for meeting_id, _ in meetings:
            for label, delta in STANDARD_OUTCOMES:
                cur.execute(
                    """
                    insert into public.outcomes (meeting_id, label, delta_bps)
                    values (%s, %s, %s)
                    on conflict (meeting_id, delta_bps) do nothing
                    """,
                    (meeting_id, label, delta),
                )
                total_outcomes += 1
        print(f"  outcomes seeded: {total_outcomes} upsert attempts")

        # 4. probability_snapshots: seed one mock snapshot per outcome so UI has data
        now = datetime.now(timezone.utc).replace(microsecond=0)
        now_iso = now.isoformat()
        today_iso = now.date().isoformat()

        cur.execute(
            """
            select o.id, o.delta_bps, m.meeting_date
            from public.outcomes o
            join public.meetings m on m.id = o.meeting_id
            where m.status = 'scheduled'
            """
        )
        rows = cur.fetchall()
        total_snapshots = 0
        for outcome_id, delta_bps, meeting_date in rows:
            probs = pick_mock_probs(meeting_date.isoformat(), today_iso)
            prob = probs.get(delta_bps, 0.0)
            cur.execute(
                """
                insert into public.probability_snapshots (outcome_id, snapshot_at, probability, source)
                values (%s, %s, %s, 'seed')
                on conflict (outcome_id, snapshot_at) do nothing
                """,
                (outcome_id, now_iso, prob),
            )
            total_snapshots += 1
        print(f"  probability snapshots seeded: {total_snapshots} @ {now_iso}")


def main() -> int:
    db_url = os.environ.get("RR_DB_URL")
    if not db_url:
        print("RR_DB_URL env var is not set", file=sys.stderr)
        return 2

    if "sslmode=" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    print("Seeding RateRadar Supabase...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        seed(conn)
    finally:
        conn.close()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
