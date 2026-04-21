"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProbabilitySeries } from "@/lib/types";

interface Props {
  meetingId: string;
  windowDays?: 7 | 30 | 60 | 90 | 365;
  initialSeries?: ProbabilitySeries[];
}

// Color palette consistent with ProbabilityTable — cuts emerald, hold blue, hikes red
const OUTCOME_COLORS: Record<number, string> = {
  [-50]: "#10b981", // emerald-500
  [-25]: "#34d399", // emerald-400
  [0]: "#60a5fa", // blue-400
  [25]: "#f87171", // red-400
  [50]: "#ef4444", // red-500
};

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function HistoricalChart({
  meetingId,
  windowDays = 60,
  initialSeries,
}: Props) {
  const [series, setSeries] = useState<ProbabilitySeries[]>(initialSeries ?? []);
  const [loading, setLoading] = useState(!initialSeries);

  useEffect(() => {
    if (initialSeries) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/fed/meetings/${meetingId}/history?window=${windowDays}d`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { data: ProbabilitySeries[] };
        if (!cancelled) setSeries(json.data);
      } catch {
        if (!cancelled) setSeries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [meetingId, windowDays, initialSeries]);

  // Transform series-of-series into a single wide-format array for Recharts:
  //   [{ date: "2026-02-20", "-50bp": 0.01, "-25bp": 0.08, ... }, ...]
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    const dateMap = new Map<string, Record<string, number | string>>();
    for (const s of series) {
      for (const pt of s.series) {
        const dateKey = pt.snapshot_at.slice(0, 10);
        const row = dateMap.get(dateKey) ?? { date: dateKey };
        row[s.label] = Math.round(pt.probability * 1000) / 10; // percent with 1dp
        dateMap.set(dateKey, row);
      }
    }
    return Array.from(dateMap.values()).sort((a, b) =>
      String(a.date) < String(b.date) ? -1 : 1,
    );
  }, [series]);

  const visibleLabels = useMemo(() => series.map((s) => s.label), [series]);

  if (loading && chartData.length === 0) {
    return (
      <div className="h-40 rounded-lg border border-zinc-800 bg-zinc-950/50 flex items-center justify-center text-sm text-zinc-600">
        Loading history…
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div className="h-40 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 flex items-center justify-center text-sm text-zinc-600">
        No history yet — come back after we capture more snapshots.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Probability history · last {windowDays} days
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {series.map((s) => {
            const color = OUTCOME_COLORS[s.delta_bps] ?? "#a1a1aa";
            return (
              <span
                key={s.outcome_id}
                className="inline-flex items-center gap-1.5 text-zinc-400"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {s.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              stroke="#52525b"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#52525b"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                border: "1px solid #27272a",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e4e4e7", marginBottom: "4px" }}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              }
              formatter={(value, name) => {
                const num = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(num) ? `${num.toFixed(1)}%` : "—", String(name)];
              }}
            />
            {visibleLabels.map((label) => {
              const delta =
                series.find((s) => s.label === label)?.delta_bps ?? 0;
              return (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={OUTCOME_COLORS[delta] ?? "#a1a1aa"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
