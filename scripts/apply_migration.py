"""Apply a Supabase migration via direct Postgres connection.

One-shot helper for initial schema setup when the Supabase CLI isn't authenticated.
Reads the DB URL from the `RR_DB_URL` environment variable so credentials never
appear in shell command arguments.

Usage:
    export RR_DB_URL="$(cat /c/Users/levin/.rr_db_url)"
    python scripts/apply_migration.py supabase/migrations/20260421000000_initial.sql
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: apply_migration.py <path-to-sql-file>", file=sys.stderr)
        return 2

    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        print(f"File not found: {sql_path}", file=sys.stderr)
        return 2

    db_url = os.environ.get("RR_DB_URL")
    if not db_url:
        print("RR_DB_URL env var is not set", file=sys.stderr)
        return 2

    sql = sql_path.read_text(encoding="utf-8")

    # Use a safe SSL mode (Supabase requires TLS)
    if "sslmode=" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    print(f"Connecting to Supabase Postgres...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            # Read back some sanity info
            cur.execute("select table_name from information_schema.tables where table_schema='public' order by table_name")
            tables = [row[0] for row in cur.fetchall()]
        print(f"Migration applied successfully. Public tables: {', '.join(tables)}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
