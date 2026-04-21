"""Data pipeline orchestrator — CLI entry point.

Usage:
    python -m src.main --bank fed --year 2026 --source mock
    python -m src.main --bank ecb --year 2026 --source mock
    python -m src.main --bank fed --source yfinance --write

Flags:
    --bank          fed | ecb
    --year          Year to pull meetings from (default 2026)
    --source        'mock' | 'yfinance' (default: mock for safety)
    --current-rate  Current policy-rate midpoint (percent). Default auto-picks
                    by bank: 4.375 for FED, 2.00 for ECB.
    --write         If set, writes snapshots to Supabase via RR_DB_URL.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone

from .ecb_fetcher import run_ecb_fetch
from .fed_fetcher import MeetingProbability, run_fed_fetch
from .fetchers.base import PriceFetcher
from .fetchers.ecb_mock_source import EcbMockFetcher
from .fetchers.mock_source import MockFetcher

logger = logging.getLogger(__name__)


DEFAULT_RATES = {
    "fed": 4.375,
    "ecb": 2.00,
}


def build_fetcher(source: str, bank: str) -> PriceFetcher:
    if source == "mock":
        return EcbMockFetcher() if bank == "ecb" else MockFetcher()
    if source == "yfinance":
        # Imported lazily so mock mode doesn't require yfinance/requests at runtime
        from .fetchers.yfinance_source import YFinanceFetcher

        if bank == "ecb":
            raise NotImplementedError(
                "yfinance source not supported for ECB yet — use --source mock for now"
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
            print(f"\n-- Meeting: {r.meeting_date} --------------------------")
            print(f"  {'Outcome':>8}  {'Probability':>12}  {'Post-rate %':>12}")
            print(f"  {'-' * 8}  {'-' * 12}  {'-' * 12}")
        pct = f"{r.probability * 100:>10.2f}%"
        rate = f"{r.post_meeting_rate:>10.3f}%"
        print(f"  {r.outcome_label:>8}  {pct:>12}  {rate:>12}")


def main() -> int:
    parser = argparse.ArgumentParser(description="RateRadar data pipeline")
    parser.add_argument("--bank", choices=["fed", "ecb"], default="fed")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--source", choices=["mock", "yfinance"], default="mock")
    parser.add_argument(
        "--current-rate",
        type=float,
        default=None,
        help="Current policy-rate midpoint, percent. Defaults by bank "
        "(FED: 4.375%, ECB: 2.00%).",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write snapshots to Supabase (requires RR_DB_URL env var)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable debug logging"
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    current_rate = (
        args.current_rate if args.current_rate is not None else DEFAULT_RATES[args.bank]
    )
    fetcher = build_fetcher(args.source, args.bank)

    logger.info(
        "Running %s fetch: year=%s source=%s current_rate=%.3f%%",
        args.bank.upper(),
        args.year,
        args.source,
        current_rate,
    )
    started_at = datetime.now(timezone.utc)
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

    if args.write:
        import os

        import psycopg2

        from .supabase_writer import write_probabilities

        db_url = os.environ.get("RR_DB_URL") or os.environ.get("SUPABASE_DB_URL")
        if not db_url:
            print(
                "\n[--write requires RR_DB_URL or SUPABASE_DB_URL env var pointing to "
                "the Supabase Postgres connection string]",
                file=sys.stderr,
            )
            return 3
        if "sslmode=" not in db_url:
            db_url += "&sslmode=require" if "?" in db_url else "?sslmode=require"

        logger.info("Connecting to Supabase to upsert snapshots...")
        conn = psycopg2.connect(db_url)
        try:
            written, missing = write_probabilities(
                conn, results, bank_code=args.bank.upper(), source="pipeline"
            )
        finally:
            conn.close()
        print(f"\nWrote {written} probability snapshots to Supabase ({missing} unmatched).")

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info("Done in %.2fs", elapsed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
