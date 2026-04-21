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
export function ImpliedRateCurve({ snapshots, startingRate, bankLabel }: Props) {
  if (snapshots.length === 0) return null;

  let runningRate = startingRate;
  const data = [
    { label: "Now", fullLabel: "Today", rate: runningRate },
    ...snapshots.map((s) => {
      const expectedDeltaBps = s.outcomes.reduce(
        (acc, o) => acc + o.probability * o.delta_bps,
        0,
      );
      runningRate += expectedDeltaBps / 100; // bps -> percent
      return {
        label: formatShort(s.meeting.meeting_date),
        fullLabel: new Date(s.meeting.meeting_date + "T00:00:00").toLocaleDateString(
          "en-US",
          { weekday: "short", month: "short", day: "numeric" },
        ),
        rate: runningRate,
      };
    }),
  ];

  const min = Math.min(...data.map((d) => d.rate)) - 0.25;
  const max = Math.max(...data.map((d) => d.rate)) + 0.25;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Implied policy-rate path
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          {bankLabel} — expected rate at each upcoming meeting, derived from today&apos;s
          probability distribution.
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="#52525b"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              interval={0}
            />
            <YAxis
              domain={[min, max]}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              stroke="#52525b"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                border: "1px solid #27272a",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e4e4e7", marginBottom: "4px" }}
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
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ fill: "#34d399", r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
