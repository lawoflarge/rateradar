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

// Wire Room palette — cut amber, hold sage, hike rust, with intensity tweaks per step
const OUTCOME_COLORS: Record<number, string> = {
  [-50]: "#A06208", // deep cut
  [-25]: "#C8841C", // cut amber
  [0]: "#3E5640", // hold sage
  [25]: "#A8312A", // hike rust
  [50]: "#7A1F1B", // deep hike
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
          `/api/meetings/${meetingId}/history?window=${windowDays}d`,
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

  // Only outcomes that actually have historical points should appear in the
  // legend and as chart lines — otherwise an outcome with no snapshots yet
  // renders a legend dot with no corresponding line.
  const populatedSeries = useMemo(
    () => series.filter((s) => s.series.length > 0),
    [series],
  );
  const visibleLabels = useMemo(
    () => populatedSeries.map((s) => s.label),
    [populatedSeries],
  );

  if (loading && chartData.length === 0) {
    return (
      <div className="h-40 rounded-lg border border-ink/15 bg-cream-soft flex items-center justify-center text-sm text-ink-mute">
        Loading history…
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div className="h-40 rounded-lg border border-dashed border-ink/15 bg-cream-soft flex items-center justify-center text-sm text-ink-mute">
        No history yet. Come back after we capture more snapshots.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/15 bg-cream-soft p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-ink-mute">
          Probability history · last {windowDays} days
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {populatedSeries.map((s) => {
            const color = OUTCOME_COLORS[s.delta_bps] ?? "#1A1A1A";
            return (
              <span
                key={s.outcome_id}
                className="inline-flex items-center gap-1.5 font-mono tabular-nums text-ink-mute"
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
            <CartesianGrid stroke="#1A1A1A" strokeOpacity={0.12} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              stroke="#1A1A1A"
              strokeOpacity={0.25}
              tick={{ fontSize: 11, fill: "#1A1A1A", fillOpacity: 0.55, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#1A1A1A"
              strokeOpacity={0.25}
              tick={{ fontSize: 11, fill: "#1A1A1A", fillOpacity: 0.55, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#F5EFE3",
                border: "1px solid rgba(26,26,26,0.15)",
                borderRadius: "0",
                fontSize: "12px",
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                color: "#1A1A1A",
              }}
              labelStyle={{ color: "#1A1A1A", marginBottom: "4px" }}
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
                populatedSeries.find((s) => s.label === label)?.delta_bps ?? 0;
              return (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={OUTCOME_COLORS[delta] ?? "#1A1A1A"}
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
