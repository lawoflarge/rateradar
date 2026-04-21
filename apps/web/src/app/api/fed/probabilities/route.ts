/**
 * GET /api/fed/probabilities
 *
 * Returns current probability snapshots for upcoming Fed meetings.
 * Currently serves mock data; will read from Supabase `probability_snapshots`
 * in Phase 1b once the project is spun up.
 */

import { NextResponse } from "next/server";
import { getFedProbabilities } from "@/lib/data";

export async function GET() {
  const data = await getFedProbabilities();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
