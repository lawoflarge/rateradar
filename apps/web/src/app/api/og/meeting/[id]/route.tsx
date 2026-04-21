/**
 * Dynamic Open Graph image generator for meeting shares.
 *
 * GET /api/og/meeting/:id  -> 1200x630 PNG with probability snapshot
 *
 * Next.js 16 `ImageResponse` renders React to an image via Satori. Kept to
 * a subset of CSS that Satori supports (flexbox, solid colors, system fonts).
 */

import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { getMeetingById } from "@/lib/data";

export const runtime = "nodejs";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const OUTCOME_COLOR: Record<number, string> = {
  [-50]: "#10b981",
  [-25]: "#34d399",
  [0]: "#60a5fa",
  [25]: "#f87171",
  [50]: "#ef4444",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getMeetingById(id);

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#09090b",
            color: "#a1a1aa",
            fontSize: 48,
          }}
        >
          Meeting not found
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const sorted = [...data.outcomes].sort((a, b) => a.delta_bps - b.delta_bps);
  const top = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];
  const bank = data.meeting.bank_code;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #052e2b 0%, #09090b 60%, #09090b 100%)",
          color: "#e4e4e7",
          padding: 60,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#a7f3d0",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "3px solid #34d399",
              boxShadow: "0 0 30px rgba(52, 211, 153, 0.6)",
            }}
          />
          <div style={{ fontWeight: 600, letterSpacing: -0.5 }}>RateRadar</div>
        </div>

        {/* Heading */}
        <div style={{ marginTop: 60, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              color: "#34d399",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {bank === "FED" ? "Federal Reserve" : "European Central Bank"}
          </div>
          <div style={{ marginTop: 12, fontSize: 56, fontWeight: 600, lineHeight: 1.1 }}>
            {formatDate(data.meeting.meeting_date)}
          </div>
        </div>

        {/* Top outcome */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            alignItems: "baseline",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 700, color: "#6ee7b7" }}>
            {Math.round(top.probability * 100)}%
          </div>
          <div style={{ fontSize: 42, color: "#e4e4e7" }}>
            {top.label === "Hold" ? "holds rates" : `moves ${top.label}`}
          </div>
        </div>

        {/* Outcome bars */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {sorted.map((o) => {
            const color = OUTCOME_COLOR[o.delta_bps] ?? "#a1a1aa";
            const width = Math.max(o.probability * 800, 2);
            return (
              <div
                key={o.id}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <div style={{ width: 90, color: "#a1a1aa", fontSize: 22 }}>
                  {o.label}
                </div>
                <div
                  style={{
                    width,
                    height: 12,
                    background: color,
                    borderRadius: 6,
                  }}
                />
                <div
                  style={{
                    color: "#d4d4d8",
                    fontSize: 22,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(o.probability * 100).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: "auto",
            color: "#71717a",
            fontSize: 20,
            display: "flex",
          }}
        >
          Market-implied probabilities · historical tracking · rateradar-web.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
