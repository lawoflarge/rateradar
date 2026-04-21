/**
 * GET /api/fed/meetings/:id/history?window=60d
 *
 * Returns historical probability time series for a single meeting — one
 * series per outcome, chronologically sorted.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getMeetingHistory } from "@/lib/data";

const WINDOW_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "1y": 365,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const windowParam = req.nextUrl.searchParams.get("window") ?? "60d";
  const windowDays = WINDOW_DAYS[windowParam] ?? 60;

  const series = await getMeetingHistory(id, windowDays);
  return NextResponse.json(
    { data: series, window_days: windowDays },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
