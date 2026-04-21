/**
 * GET /api/status
 *
 * Lightweight health/status endpoint — reports whether Supabase is reachable
 * and returns summary counts useful for dashboards and uptime monitors.
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 60;

interface Status {
  ok: boolean;
  supabase: "configured" | "missing_env" | "error";
  counts?: {
    meetings: number | null;
    outcomes: number | null;
    snapshots: number | null;
  };
  latest_snapshot_at: string | null;
  version: string;
}

export async function GET() {
  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasEnv) {
    const body: Status = {
      ok: true,
      supabase: "missing_env",
      latest_snapshot_at: null,
      version: "0.1.0",
    };
    return NextResponse.json(body);
  }

  try {
    const supabase = getSupabase();

    const [meetingsRes, outcomesRes, snapshotsRes, latestRes] = await Promise.all([
      supabase.from("meetings").select("*", { count: "exact", head: true }),
      supabase.from("outcomes").select("*", { count: "exact", head: true }),
      supabase.from("probability_snapshots").select("*", { count: "exact", head: true }),
      supabase
        .from("probability_snapshots")
        .select("snapshot_at")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const body: Status = {
      ok: true,
      supabase: "configured",
      counts: {
        meetings: meetingsRes.count ?? null,
        outcomes: outcomesRes.count ?? null,
        snapshots: snapshotsRes.count ?? null,
      },
      latest_snapshot_at: latestRes.data?.snapshot_at ?? null,
      version: "0.1.0",
    };
    return NextResponse.json(body);
  } catch (err) {
    const body: Status = {
      ok: false,
      supabase: "error",
      latest_snapshot_at: null,
      version: "0.1.0",
    };
    console.error("Status probe failed:", err);
    return NextResponse.json(body, { status: 503 });
  }
}
