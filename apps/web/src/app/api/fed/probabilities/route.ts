/**
 * GET /api/fed/probabilities
 *
 * Returns current probability snapshots for upcoming Fed meetings.
 * Currently serves mock data; will read from Supabase `probability_snapshots`
 * in Phase 1b once the project is spun up.
 */

import { NextResponse } from "next/server";
import { MOCK_FED_PROBABILITIES } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(
    { data: MOCK_FED_PROBABILITIES },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
