"""Data pipeline orchestrator — CLI entry point.

Usage:
    python -m src.main --bank fed --year 2026 --source mock
    python -m src.main --bank ecb --year 2026 --source mock
    python -m src.main --bank fed --source yfinance --write
    python -m src.main --bank fed --source mock --write \
        --json-snapshot-dir services/data-pipeline/snapshots

Flags:
    --bank               fed | ecb
    --year               Year to pull meetings from (default 2026)
    --source             'mock' | 'yfinance' (default: mock for safety)
    --current-rate       Current policy-rate midpoint (percent). REQUIRED for FED
                         (or set RR_FED_CURRENT_RATE); ECB defaults to 2.00%.
    --write              Best-effort Supabase upsert via RR_DB_URL. Database
                         outages (paused project, DNS NXDOMAIN, refused
                         connection) downgrade to a warning so the cron job
                         stays green.
    --require-db         Treat any DB outage as a hard failure. Useful for
                         smoke-tests when you specifically want to assert the
                         DB is reachable.
    --json-snapshot-dir  When set, writes a JSON snapshot file per run.
                         Always succeeds (no network). The web reads these
                         files as a fallback when the DB is empty.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from .ecb_fetcher import run_ecb_fetch
from .fed_fetcher import MeetingProbability, run_fed_fetch
from .fetchers.base import PriceFetcher
from .fetchers.ecb_mock_source import EcbMockFetcher
from .fetchers.mock_source import MockFetcher
from .json_writer import write_snapshot_files

logger = logging.getLogger(__name__)


DEFAULT_RATES = {
    "ecb": 2.00,
}


def resolve_current_rate(bank: str, cli_value: float | None, env: str | None) -> float:
    """Resolve the current policy-rate midpoint.

    FED has no hard-coded default (the old 4.375 went stale — the real Fed mid
    is 3.625 since 2026-04-29). FED must be given explicitly via --current-rate
    or the RR_FED_CURRENT_RATE env var. ECB keeps its documented default.
    """
    if cli_value is not None:
        return cli_value
    if bank == "fed":
        if env is not None:
            return float(env)
        print(
            "[--current-rate is required for FED (no stale default). Pass "
            "--current-rate 3.625 or set RR_FED_CURRENT_RATE. Real Fed mid is "
            "3.625 / range 3.50-3.75 since 2026-04-29.]",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return DEFAULT_RATES[bank]


METHODOLOGY_VERSION = "1.1.0"


def build_fetcher(source: str, bank: str) -> PriceFetcher:
    if source == "mock":
        return EcbMockFetcher() if bank == "ecb" else MockFetcher()
    if source == "yfinance":
        from .fetchers.yfinance_source import YFinanceFetcher

        if bank == "ecb":
            raise NotImplementedError(
                "yfinance source not supported for ECB yet, use --source mock for now."
            )
        return YFinanceFetcher()
    raise ValueError(f"Unknown source: {source}. Valid: mock, yfinance")


def print_probabilities(results: list[MeetingProbability]) -> None:
    if not results:
        print("(no probabilities computed)")
        return

    current_meeting = None
    for r in results:
        if r.meeting_date != current_meeting:
            current_meeting = r.meeting_date
            print(f"\n.. Meeting: {r.meeting_date} ..........................")
            print(f"  {'Outcome':>8}  {'Probability':>12}  {'Post-rate %':>12}")
            print(f"  {'-' * 8}  {'-' * 12}  {'-' * 12}")
        pct = f"{r.probability * 100:>10.2f}%"
        rate = f"{r.post_meeting_rate:>10.3f}%"
        print(f"  {r.outcome_label:>8}  {pct:>12}  {rate:>12}")


def _is_pooler_tenant_missing(err: Exception) -> bool:
    """Return True for the specific Supavisor 'tenant/user not found' error.

    Supabase's pooler raises this when the project ref does not exist or the
    project is paused. We treat it as a recoverable outage so the cron can
    keep computing + writing JSON snapshots without going red.
    """
    msg = str(err).lower()
    return "tenant" in msg and "not found" in msg


def _is_network_outage(err: Exception) -> bool:
    """Return True for connection-level failures (DNS NXDOMAIN, refused, timeout)."""
    msg = str(err).lower()
    signals = (
        "could not translate host name",  # DNS failure
        "name or service not known",
        "nodename nor servname provided",
        "connection refused",
        "connection timed out",
        "no route to host",
        "network is unreachable",
    )
    return any(s in msg for s in signals)


def write_to_supabase(
    db_url: str,
    results: list[MeetingProbability],
    bank: str,
    require_db: bool,
) -> tuple[int, int] | None:
    """Best-effort Supabase write. Returns (written, missing) or None on outage."""
    import psycopg2
    from psycopg2 import OperationalError

    from .supabase_writer import write_probabilities

    if "sslmode=" not in db_url:
        db_url += "&sslmode=require" if "?" in db_url else "?sslmode=require"

    try:
        logger.info("Connecting to Supabase to upsert snapshots...")
        conn = psycopg2.connect(db_url)
    except OperationalError as exc:
        if not require_db and (_is_pooler_tenant_missing(exc) or _is_network_outage(exc)):
            logger.warning(
                "Supabase write skipped (project paused, deleted, or unreachable): %s",
                str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__,
            )
            return None
        raise

    try:
        written, missing = write_probabilities(
            conn, results, bank_code=bank.upper(), source="pipeline"
        )
    finally:
        conn.close()
    return written, missing


def main() -> int:
    parser = argparse.ArgumentParser(description="RateRadar data pipeline")
    parser.add_argument("--bank", choices=["fed", "ecb"], default="fed")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--source", choices=["mock", "yfinance"], default="mock")
    parser.add_argument(
        "--current-rate",
        type=float,
        default=None,
        help="Current policy-rate midpoint, percent. REQUIRED for FED "
        "(or set RR_FED_CURRENT_RATE); ECB defaults to 2.00%%.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Best-effort Supabase write (RR_DB_URL). Outages do not fail the job.",
    )
    parser.add_argument(
        "--require-db",
        action="store_true",
        help="Treat any DB outage as a hard failure (overrides --write tolerance).",
    )
    parser.add_argument(
        "--json-snapshot-dir",
        type=Path,
        default=None,
        help="If set, write snapshot JSON files to this directory (always runs).",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    current_rate = resolve_current_rate(
        bank=args.bank,
        cli_value=args.current_rate,
        env=os.environ.get("RR_FED_CURRENT_RATE"),
    )
    fetcher = build_fetcher(args.source, args.bank)

    logger.info(
        "Running %s fetch: year=%s source=%s current_rate=%.3f%%",
        args.bank.upper(),
        args.year,
        args.source,
        current_rate,
    )
    started_at = datetime.now(UTC).replace(microsecond=0)
    if args.bank == "fed":
        results = run_fed_fetch(
            fetcher=fetcher,
            current_target_midpoint=current_rate,
            year=args.year,
        )
    else:
        results = run_ecb_fetch(
            fetcher=fetcher,
            current_target=current_rate,
            year=args.year,
        )
    logger.info("Computed %d probability rows", len(results))

    print_probabilities(results)

    if args.json_snapshot_dir is not None:
        latest, history = write_snapshot_files(
            snapshot_dir=args.json_snapshot_dir,
            bank_code=args.bank.upper(),
            probabilities=results,
            snapshot_at=started_at,
            methodology_version=METHODOLOGY_VERSION,
        )
        print(f"\nWrote JSON snapshot: {latest}")
        print(f"Appended history:    {history}")

    if args.write:
        db_url = os.environ.get("RR_DB_URL") or os.environ.get("SUPABASE_DB_URL")
        if not db_url:
            print(
                "\n[--write requires RR_DB_URL or SUPABASE_DB_URL env var pointing to "
                "the Supabase Postgres connection string]",
                file=sys.stderr,
            )
            return 3

        outcome = write_to_supabase(db_url, results, args.bank, args.require_db)
        if outcome is None:
            print(
                "\n[Supabase write skipped: project paused / unreachable. "
                "JSON snapshot still written. Unpause the project at "
                "https://supabase.com/dashboard to resume DB writes.]",
                file=sys.stderr,
            )
        else:
            written, missing = outcome
            print(f"\nWrote {written} probability snapshots to Supabase ({missing} unmatched).")

    elapsed = (datetime.now(UTC) - started_at).total_seconds()
    logger.info("Done in %.2fs", elapsed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
