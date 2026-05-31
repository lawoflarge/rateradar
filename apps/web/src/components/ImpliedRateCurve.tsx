"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MeetingProbabilities } from "@/lib/types";

interface Props {
  snapshots: MeetingProbabilities[];
  startingRate: number; // percent, e.g. 4.375 for Fed mid-2026
  bankLabel: string;
  anchorLabel?: string; // x-axis label for the starting point (default "Now")
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Computes the market-implied expected policy rate at each upcoming meeting,
 * starting from the current policy rate and chaining per-meeting expected
 * changes (Σ p_i · Δ_i).
 */
export function ImpliedRateCurve({
  snapshots,
  startingRate,
  bankLabel,
  anchorLabel = "Now",
}: Props) {
  if (snapshots.length === 0) return null;

  // Use reduce instead of a mutable `let` counter — React 19's purity rule
  // flags reassignment during render.
  type CurvePoint = { label: string; fullLabel: string; rate: number };
  const data: CurvePoint[] = snapshots.reduce<CurvePoint[]>(
    (acc, s) => {
      const prevRate = acc.length === 0 ? startingRate : acc[acc.length - 1].rate;
      const expectedDeltaBps = s.outcomes.reduce(
        (a, o) => a + o.probability * o.delta_bps,
        0,
      );
      const nextRate = prevRate + expectedDeltaBps / 100; // bps -> percent
      return [
        ...acc,
        {
          label: formatShort(s.meeting.meeting_date),
          fullLabel: new Date(s.meeting.meeting_date + "T00:00:00").toLocaleDateString(
            "en-US",
            { weekday: "short", month: "short", day: "numeric" },
          ),
          rate: nextRate,
        },
      ];
    },
    [{ label: anchorLabel, fullLabel: anchorLabel, rate: startingRate }],
  );

  const min = Math.min(...data.map((d) => d.rate)) - 0.25;
  const max = Math.max(...data.map((d) => d.rate)) + 0.25;

  return (
    <div className="rounded-none border border-ink/15 bg-cream-soft p-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-ink-mute">
          Implied policy-rate path
        </div>
        <div className="mt-1 text-sm text-ink-mute">
          {bankLabel}. Expected rate at each upcoming meeting, derived from today&apos;s
          probability distribution.
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#1A1A1A" strokeOpacity={0.12} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="#1A1A1A"
              strokeOpacity={0.25}
              tick={{ fontSize: 11, fill: "#1A1A1A", fillOpacity: 0.55, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              interval={0}
            />
            <YAxis
              domain={[min, max]}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              stroke="#1A1A1A"
              strokeOpacity={0.25}
              tick={{ fontSize: 11, fill: "#1A1A1A", fillOpacity: 0.55, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              width={60}
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
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload as { fullLabel: string } | undefined;
                return point?.fullLabel ?? String(label);
              }}
              formatter={(value) => {
                const num = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(num) ? `${num.toFixed(3)}%` : "—", "Rate"];
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#C8841C"
              strokeWidth={2.5}
              dot={{ fill: "#C8841C", r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
