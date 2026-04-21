"""Persist computed probabilities to Supabase.

Converts `MeetingProbability` records from `fed_fetcher` / `ecb_fetcher` into
rows in `public.probability_snapshots`, matching them to their meeting +
outcome UUIDs via (bank_code, meeting_date, delta_bps).

I/O is isolated here so `fed_fetcher.py` and `probability_calc.py` stay pure
and testable without a database.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutcomeKey:
    """Identifies an outcome row by its natural key (not UUID)."""

    bank_code: str  # 'FED' | 'ECB'
    meeting_date: date
    delta_bps: int


@dataclass(frozen=True)
class SnapshotRow:
    """One row to upsert into probability_snapshots."""

    outcome_id: str
    probability: float
    snapshot_at: datetime
    source: str


class Cursor(Protocol):
    """Minimal psycopg2 cursor surface — lets us type without pulling psycopg2 into tests."""

    def execute(self, query: str, params: object | None = ...) -> None: ...
    def fetchall(self) -> list[tuple[object, ...]]: ...


def resolve_outcome_ids(
    cur: Cursor,
    keys: list[OutcomeKey],
) -> dict[OutcomeKey, str]:
    """Look up UUIDs for a batch of outcome keys. Returns a map; missing keys absent.

    Pure DB reads — safe to call against any psycopg2 cursor. Unresolved keys
    (meeting or outcome not in DB) are silently omitted; callers should log
    the absence and decide whether to create them.
    """
    if not keys:
        return {}

    bank_codes = sorted({k.bank_code for k in keys})

    cur.execute(
        """
        select cb.code, m.meeting_date, o.delta_bps, o.id
        from public.outcomes o
        join public.meetings m on m.id = o.meeting_id
        join public.central_banks cb on cb.id = m.bank_id
        where cb.code = any(%s)
        """,
        (bank_codes,),
    )

    resolved: dict[OutcomeKey, str] = {}
    for code, meeting_date, delta_bps, outcome_id in cur.fetchall():
        k = OutcomeKey(bank_code=code, meeting_date=meeting_date, delta_bps=delta_bps)
        resolved[k] = str(outcome_id)
    return resolved


def upsert_snapshots(
    cur: Cursor,
    rows: list[SnapshotRow],
) -> int:
    """Upsert snapshot rows. Returns count of rows written.

    Uses `on conflict (outcome_id, snapshot_at) do update set probability = excluded.probability`
    so re-running with the same timestamp updates the probability rather than failing.
    """
    if not rows:
        return 0

    for r in rows:
        cur.execute(
            """
            insert into public.probability_snapshots
              (outcome_id, snapshot_at, probability, source)
            values (%s, %s, %s, %s)
            on conflict (outcome_id, snapshot_at) do update
              set probability = excluded.probability,
                  source = excluded.source
            """,
            (r.outcome_id, r.snapshot_at, r.probability, r.source),
        )
    return len(rows)


def write_probabilities(
    conn,
    probabilities,
    bank_code: str,
    source: str = "pipeline",
    snapshot_at: datetime | None = None,
) -> tuple[int, int]:
    """Top-level entry. Takes a list of `MeetingProbability` from a fetcher,
    resolves each to its outcome UUID, and upserts one snapshot row per match.

    Returns `(written, missing)` counts.
    """
    if snapshot_at is None:
        snapshot_at = datetime.now(UTC).replace(microsecond=0)

    keys = [
        OutcomeKey(
            bank_code=bank_code,
            meeting_date=p.meeting_date,
            delta_bps=p.outcome_delta_bps,
        )
        for p in probabilities
    ]

    with conn.cursor() as cur:
        resolved = resolve_outcome_ids(cur, keys)

    rows: list[SnapshotRow] = []
    missing = 0
    for p in probabilities:
        k = OutcomeKey(
            bank_code=bank_code,
            meeting_date=p.meeting_date,
            delta_bps=p.outcome_delta_bps,
        )
        outcome_id = resolved.get(k)
        if outcome_id is None:
            missing += 1
            logger.warning(
                "No outcome row for %s %s %s — skipping",
                bank_code,
                p.meeting_date,
                p.outcome_delta_bps,
            )
            continue
        rows.append(
            SnapshotRow(
                outcome_id=outcome_id,
                probability=p.probability,
                snapshot_at=snapshot_at,
                source=source,
            )
        )

    with conn.cursor() as cur:
        written = upsert_snapshots(cur, rows)
    conn.commit()

    return written, missing
