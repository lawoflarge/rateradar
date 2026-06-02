/**
 * GET /api/status
 *
 * Lightweight health/status endpoint. Production's real data source is the
 * git-committed JSON snapshots (Supabase free tier is paused), so a paused or
 * unreachable Supabase is NOT an outage — it's the expected state. We report
 * JSON-snapshot freshness for both banks and only flag a real outage (ok:false
 * / 503) when neither Supabase nor a JSON snapshot is available.
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { loadJsonSnapshotAt } from "@/lib/snapshots";

export const revalidate = 60;

type SnapshotInfo = { at: string; version: string | null } | null;

interface Status {
  ok: boolean;
  supabase: "configured" | "missing_env" | "error";
  data_source: "supabase" | "json_snapshots" | "none";
  counts?: {
    meetings: number | null;
    outcomes: number | null;
    snapshots: number | null;
  };
  snapshots?: {
    fed: SnapshotInfo;
    ecb: SnapshotInfo;
  };
  latest_snapshot_at: string | null;
  version: string;
}

export async function GET() {
  const [fedSnap, ecbSnap] = await Promise.all([
    loadJsonSnapshotAt("FED"),
    loadJsonSnapshotAt("ECB"),
  ]);
  const haveJson = Boolean(fedSnap || ecbSnap);
  const snapshots: Status["snapshots"] = { fed: fedSnap, ecb: ecbSnap };

  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasEnv) {
    const body: Status = {
      ok: haveJson,
      supabase: "missing_env",
      data_source: haveJson ? "json_snapshots" : "none",
      snapshots,
      latest_snapshot_at: null,
      version: "0.1.0",
    };
    return NextResponse.json(body, { status: haveJson ? 200 : 503 });
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
      data_source: "supabase",
      counts: {
        meetings: meetingsRes.count ?? null,
        outcomes: outcomesRes.count ?? null,
        snapshots: snapshotsRes.count ?? null,
      },
      snapshots,
      latest_snapshot_at: latestRes.data?.snapshot_at ?? null,
      version: "0.1.0",
    };
    return NextResponse.json(body);
  } catch (err) {
    // Supabase configured but unreachable (e.g. free-tier paused). If JSON
    // snapshots exist, that is the true production data source → ok / 200.
    const body: Status = {
      ok: haveJson,
      supabase: "error",
      data_source: haveJson ? "json_snapshots" : "none",
      snapshots,
      latest_snapshot_at: null,
      version: "0.1.0",
    };
    console.error("Status probe failed:", err);
    return NextResponse.json(body, { status: haveJson ? 200 : 503 });
  }
}
