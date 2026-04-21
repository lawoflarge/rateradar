"""Unit tests for supabase_writer — uses a fake cursor so we never touch a real DB."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from src.fed_fetcher import MeetingProbability
from src.supabase_writer import (
    OutcomeKey,
    SnapshotRow,
    resolve_outcome_ids,
    upsert_snapshots,
    write_probabilities,
)


class FakeCursor:
    """Captures executed queries + params; supports fetchall() of preset rows."""

    def __init__(self, fetch_rows: list[tuple[Any, ...]] | None = None) -> None:
        self.executed: list[tuple[str, object]] = []
        self._fetch_rows = fetch_rows or []

    def execute(self, query: str, params: object | None = None) -> None:
        self.executed.append((query.strip(), params))

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._fetch_rows

    # context-manager protocol — psycopg2 cursors are used via `with conn.cursor() as cur:`
    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None


class FakeConn:
    """psycopg2-style connection that yields a preset cursor."""

    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor
        self.committed = False

    def cursor(self) -> FakeCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True


def test_resolve_outcome_ids_returns_empty_for_empty_input():
    cur = FakeCursor()
    assert resolve_outcome_ids(cur, []) == {}
    # No query should have been issued
    assert cur.executed == []


def test_resolve_outcome_ids_maps_key_to_uuid():
    fetch_rows = [
        ("FED", date(2026, 6, 17), -25, "11111111-1111-1111-1111-111111111111"),
        ("FED", date(2026, 6, 17), 0, "22222222-2222-2222-2222-222222222222"),
    ]
    cur = FakeCursor(fetch_rows=fetch_rows)

    keys = [
        OutcomeKey(bank_code="FED", meeting_date=date(2026, 6, 17), delta_bps=-25),
        OutcomeKey(bank_code="FED", meeting_date=date(2026, 6, 17), delta_bps=0),
    ]
    result = resolve_outcome_ids(cur, keys)

    assert result[keys[0]] == "11111111-1111-1111-1111-111111111111"
    assert result[keys[1]] == "22222222-2222-2222-2222-222222222222"


def test_upsert_snapshots_writes_each_row():
    cur = FakeCursor()
    rows = [
        SnapshotRow(
            outcome_id="11111111-1111-1111-1111-111111111111",
            probability=0.75,
            snapshot_at=datetime(2026, 4, 21, 22, 0, tzinfo=UTC),
            source="pipeline",
        ),
        SnapshotRow(
            outcome_id="22222222-2222-2222-2222-222222222222",
            probability=0.18,
            snapshot_at=datetime(2026, 4, 21, 22, 0, tzinfo=UTC),
            source="pipeline",
        ),
    ]
    count = upsert_snapshots(cur, rows)
    assert count == 2
    assert len(cur.executed) == 2
    # Each executed statement should be an insert with on conflict clause
    for query, _ in cur.executed:
        assert "insert into public.probability_snapshots" in query.lower()
        assert "on conflict" in query.lower()


def test_write_probabilities_end_to_end_with_mock_conn():
    fetch_rows = [
        ("FED", date(2026, 6, 17), -25, "11111111-1111-1111-1111-111111111111"),
        ("FED", date(2026, 6, 17), 0, "22222222-2222-2222-2222-222222222222"),
    ]
    cur = FakeCursor(fetch_rows=fetch_rows)
    conn = FakeConn(cur)

    probs = [
        MeetingProbability(
            meeting_date=date(2026, 6, 17),
            outcome_label="-25bp",
            outcome_delta_bps=-25,
            probability=0.55,
            post_meeting_rate=4.125,
        ),
        MeetingProbability(
            meeting_date=date(2026, 6, 17),
            outcome_label="Hold",
            outcome_delta_bps=0,
            probability=0.38,
            post_meeting_rate=4.375,
        ),
        MeetingProbability(
            # Deliberately unresolvable — different meeting not in fetch_rows
            meeting_date=date(2099, 12, 31),
            outcome_label="Hold",
            outcome_delta_bps=0,
            probability=0.99,
            post_meeting_rate=4.375,
        ),
    ]

    written, missing = write_probabilities(conn, probs, bank_code="FED", source="pipeline")
    assert written == 2
    assert missing == 1
    assert conn.committed
    # Should have issued: 1 select (resolve) + 2 inserts
    assert len(cur.executed) == 3


def test_write_probabilities_empty_input_commits_nothing_useful():
    cur = FakeCursor()
    conn = FakeConn(cur)
    written, missing = write_probabilities(conn, [], bank_code="FED")
    assert written == 0
    assert missing == 0
