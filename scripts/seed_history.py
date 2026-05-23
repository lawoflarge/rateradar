"""Seed plausible historical probability snapshots so the historical chart has
something to render pre-launch.

Narrative: over the last 60 days, markets have gradually priced in more cuts.
Each outcome's probability smoothly evolves from its "60-days-ago" value to its
"today" value via linear interpolation plus small daily noise — looks like a
real market, not a synthetic straight line.

Idempotent: skips outcomes that already have > 5 historical snapshots.

Usage:
    export RR_DB_URL="postgresql://postgres.<project_ref>:<password>@..."
    python scripts/seed_history.py [--days 60]
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from datetime import datetime, timedelta, timezone

import psycopg2

# Realistic macro narrative for each meeting distance:
#   "horizon" = how far out the meeting is (months from today)
#   Each tuple is (delta_bps, prob_60d_ago, prob_today)
# Reflects a scenario where markets have been gradually building in cuts
NARRATIVE = {
    "near": {  # 0-2 months: next meeting, less cutting priced
        -50: (0.005, 0.02),
        -25: (0.08, 0.18),
        0: (0.88, 0.75),
        25: (0.03, 0.05),
        50: (0.005, 0.00),
    },
    "mid": {  # 2-6 months: gradual cutting priced
        -50: (0.02, 0.05),
        -25: (0.35, 0.55),
        0: (0.60, 0.38),
        25: (0.02, 0.02),
        50: (0.00, 0.00),
    },
    "far": {  # 6+ months: bigger cuts expected
        -50: (0.05, 0.15),
        -25: (0.45, 0.45),
        0: (0.47, 0.37),
        25: (0.03, 0.03),
        50: (0.00, 0.00),
    },
}


def classify_horizon(meeting_date_str: str, today: datetime) -> str:
    md = datetime.fromisoformat(meeting_date_str).replace(tzinfo=timezone.utc)
    days = (md - today).days
    if days < 60:
        return "near"
    if days < 180:
        return "mid"
    return "far"


def interp_with_noise(start: float, end: float, t: float, noise: float = 0.015) -> float:
    """Linear interpolation from start to end at 0 <= t <= 1, plus gaussian-ish noise."""
    val = start * (1 - t) + end * t + random.gauss(0, noise)
    return max(0.0, min(1.0, val))


def renormalize(probs: dict[int, float]) -> dict[int, float]:
    total = sum(probs.values())
    if total <= 0:
        return probs
    return {k: v / total for k, v in probs.items()}


def seed_history(conn, days: int) -> None:
    random.seed(42)  # reproducible demo data

    today = datetime.now(timezone.utc).replace(hour=22, minute=0, second=0, microsecond=0)

    with conn.cursor() as cur:
        # Pull every scheduled-meeting outcome with its meeting_date
        cur.execute(
            """
            select o.id, o.delta_bps, m.meeting_date
            from public.outcomes o
            join public.meetings m on m.id = o.meeting_id
            where m.status = 'scheduled'
            """
        )
        rows = cur.fetchall()

        # Group outcomes by meeting
        by_meeting: dict[tuple, list[tuple[str, int]]] = {}
        for outcome_id, delta_bps, meeting_date in rows:
            key = (meeting_date,)
            by_meeting.setdefault(key, []).append((outcome_id, delta_bps))

        total_inserts = 0
        for (meeting_date,), outcomes in by_meeting.items():
            horizon = classify_horizon(meeting_date.isoformat(), today)
            story = NARRATIVE[horizon]

            # Generate one snapshot per day, normalized so probabilities sum to 1
            for day_offset in range(days, -1, -1):
                t = (days - day_offset) / days  # 0 at start, 1 today
                snap_at = today - timedelta(days=day_offset)

                raw_probs: dict[int, float] = {}
                for outcome_id, delta_bps in outcomes:
                    start, end = story.get(delta_bps, (0.0, 0.0))
                    raw_probs[delta_bps] = interp_with_noise(start, end, t)

                normalized = renormalize(raw_probs)

                for outcome_id, delta_bps in outcomes:
                    prob = round(normalized[delta_bps], 4)
                    cur.execute(
                        """
                        insert into public.probability_snapshots
                          (outcome_id, snapshot_at, probability, source)
                        values (%s, %s, %s, 'history-seed')
                        on conflict (outcome_id, snapshot_at) do nothing
                        """,
                        (outcome_id, snap_at, prob),
                    )
                    total_inserts += 1

        print(f"  Historical snapshots seeded: {total_inserts} upsert attempts")

        # Report count per meeting
        cur.execute(
            """
            select m.meeting_date, count(distinct ps.snapshot_at)
            from public.meetings m
            join public.outcomes o on o.meeting_id = m.id
            left join public.probability_snapshots ps on ps.outcome_id = o.id
            where m.status = 'scheduled'
            group by m.meeting_date
            order by m.meeting_date
            """
        )
        for date_, cnt in cur.fetchall():
            print(f"  {date_}: {cnt} snapshot timestamps")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=60, help="How many days back to seed")
    args = parser.parse_args()

    db_url = os.environ.get("RR_DB_URL")
    if not db_url:
        print("RR_DB_URL not set", file=sys.stderr)
        return 2
    if "sslmode=" not in db_url:
        db_url += "&sslmode=require" if "?" in db_url else "?sslmode=require"

    print(f"Seeding {args.days} days of historical snapshots...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        seed_history(conn, args.days)
    finally:
        conn.close()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
