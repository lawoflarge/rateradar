"""Data pipeline orchestrator — CLI entry point.

Usage:
    python -m src.main --bank fed --year 2026 --mock
    python -m src.main --bank fed --year 2026 --source yfinance

Flags:
    --bank         FED or ECB (currently only FED is implemented)
    --year         Year to pull meetings from (default 2026)
    --source       'mock' | 'yfinance' (default: mock for safety)
    --current-rate Current policy-rate midpoint (percent). Default 4.375 (Fed target 4.25-4.50)
    --write        If set, writes snapshots to Supabase. Without it, prints to stdout only.

This is the entry point that the scheduler calls. Today it writes to stdout;
Supabase integration lands when SUPABASE_URL + service key are configured.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone

from .fed_fetcher import MeetingProbability, run_fed_fetch
from .fetchers.base import PriceFetcher
from .fetchers.mock_source import MockFetcher

logger = logging.getLogger(__name__)


def build_fetcher(source: str) -> PriceFetcher:
    if source == "mock":
        return MockFetcher()
    if source == "yfinance":
        # Imported lazily so mock mode doesn't require yfinance/requests at runtime
        from .fetchers.yfinance_source import YFinanceFetcher

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
        default=4.375,
        help="Current policy-rate midpoint, percent (e.g. 4.375)",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write snapshots to Supabase (requires SUPABASE_URL + SERVICE_ROLE_KEY env vars)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable debug logging"
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if args.bank == "ecb":
        print("ECB fetcher not yet implemented — Fed only for now", file=sys.stderr)
        return 2

    fetcher = build_fetcher(args.source)
    logger.info(
        "Running Fed fetch: year=%s source=%s current_rate=%.3f%%",
        args.year,
        args.source,
        args.current_rate,
    )
    started_at = datetime.now(timezone.utc)
    results = run_fed_fetch(
        fetcher=fetcher,
        current_target_midpoint=args.current_rate,
        year=args.year,
    )
    logger.info("Computed %d probability rows", len(results))

    print_probabilities(results)

    if args.write:
        # TODO(phase-1b): wire Supabase writer once project is spun up
        print(
            "\n[--write requested but Supabase integration not yet implemented. "
            "Spin up Supabase project and re-run.]",
            file=sys.stderr,
        )
        return 3

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info("Done in %.2fs", elapsed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
