/**
 * Dynamic Open Graph image generator for meeting shares.
 *
 * GET /api/og/meeting/:id  -> 1200x630 PNG with probability snapshot
 *
 * Wire Room palette: cream background, ink foreground, cut amber / hike crimson /
 * hold sage accents. Headlines in IBM Plex Serif; figures in JetBrains Mono;
 * labels in Inter. Satori-friendly subset of CSS (flexbox, solid colors).
 */

import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { getMeetingById } from "@/lib/data";

export const runtime = "nodejs";

// Wire Room tokens (kept in sync with apps/web/src/app/globals.css).
const CREAM = "#F5F1E8";
const INK = "#0E0E0E";
const INK_MUTE = "#6F6A60";
const CUT = "#C8841C";
const HIKE = "#A8312A";
const HOLD = "#3E5640";
const RULE_15 = "rgba(14, 14, 14, 0.15)";
const RULE_12 = "rgba(14, 14, 14, 0.12)";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function bankShort(code: string): string {
  return code === "ECB" ? "ECB" : "Fed";
}

function accentForDelta(deltaBps: number): string {
  if (deltaBps < 0) return CUT;
  if (deltaBps > 0) return HIKE;
  return HOLD;
}

function actionLabel(label: string, deltaBps: number): string {
  if (deltaBps === 0 || /hold/i.test(label)) return "RATE HOLD";
  if (deltaBps < 0) return "RATE CUT";
  return "RATE HIKE";
}

// Fonts: Inter (UI/labels), IBM Plex Serif (headline), JetBrains Mono (figures).
// Satori only supports TTF/OTF, not woff2 — pin the ttf endpoints from
// Google Fonts CSS2 (resolved without a modern UA, so Google returns ttf).
// If Google bumps the version slug, refresh these.
// Fetched once per warm instance and reused across requests to avoid hitting
// fonts.gstatic.com on every render.
let ogFontsPromise: Promise<
  Array<{
    name: string;
    data: ArrayBuffer;
    style: "normal";
    weight: 400 | 500;
  }>
> | null = null;

function loadOgFonts() {
  if (!ogFontsPromise) {
    ogFontsPromise = Promise.all([
      fetch(
        new URL(
          "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
        ),
      ).then((r) => r.arrayBuffer()),
      fetch(
        new URL(
          "https://fonts.gstatic.com/s/ibmplexserif/v20/jizAREVNn1dOx-zrZ2X3pZvkTi3s-BIz.ttf",
        ),
      ).then((r) => r.arrayBuffer()),
      fetch(
        new URL(
          "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf",
        ),
      ).then((r) => r.arrayBuffer()),
    ]).then(([inter, plexSerif, jetbrainsMono]) => [
      { name: "Inter", data: inter, style: "normal" as const, weight: 400 as const },
      {
        name: "Plex Serif",
        data: plexSerif,
        style: "normal" as const,
        weight: 500 as const,
      },
      {
        name: "JetBrains Mono",
        data: jetbrainsMono,
        style: "normal" as const,
        weight: 500 as const,
      },
    ]);
  }
  return ogFontsPromise;
}

// CDN cache so repeated scrapes of the same OG image don't re-render.
const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getMeetingById(id);

  const ogFonts = await loadOgFonts();

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
            background: CREAM,
            color: INK_MUTE,
            fontSize: 48,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Meeting not found
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: ogFonts,
        headers: { "Cache-Control": OG_CACHE_CONTROL },
      },
    );
  }

  const sorted = [...data.outcomes].sort((a, b) => a.delta_bps - b.delta_bps);
  const top = [...data.outcomes].sort((a, b) => b.probability - a.probability)[0];
  const bank = bankShort(data.meeting.bank_code);
  const headline = `${bank} · ${formatDate(data.meeting.meeting_date)}`;
  const action = actionLabel(top.label, top.delta_bps);
  const accent = accentForDelta(top.delta_bps);
  const topPct = Math.round(top.probability * 100);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CREAM,
          color: INK,
          padding: 64,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Top band: wordmark — concentric-circle BrandMark recreated with stacked divs
            (Satori supports flex + borderRadius but not arbitrary SVG strokes reliably). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: INK,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 999,
              border: `1.5px solid ${INK}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: 999,
                border: `1px solid ${INK}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: CUT,
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontFamily: "Inter, sans-serif",
            }}
          >
            RateRadar
          </div>
        </div>

        {/* Horizontal hairline at ~540px from top of OG (i.e. 540 - 64 padding = 476 below wordmark area).
            We use marginTop:auto on the next block, but enforce a deliberate rule between header
            band and data with a fixed-position offset. */}

        {/* Data area: headline + figure */}
        <div
          style={{
            marginTop: 80,
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          {/* Left: headline */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: INK_MUTE,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Market-implied probability
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 84,
                lineHeight: 1.05,
                fontFamily: "Plex Serif, serif",
                fontWeight: 500,
                color: INK,
              }}
            >
              {headline}
            </div>
          </div>

          {/* Right: big figure */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 168,
                lineHeight: 1,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 500,
                color: INK,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {topPct}%
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 22,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: accent,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {action}
            </div>
          </div>
        </div>

        {/* Divider rule */}
        <div
          style={{
            marginTop: 56,
            height: 1,
            background: RULE_12,
            display: "flex",
          }}
        />

        {/* Outcome strip */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "row",
            gap: 16,
          }}
        >
          {sorted.map((o) => {
            const color = accentForDelta(o.delta_bps);
            const pct = (o.probability * 100).toFixed(0);
            return (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "14px 16px",
                  border: `1px solid ${RULE_15}`,
                  background: "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: INK_MUTE,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {o.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 6,
                    fontSize: 36,
                    fontFamily: "JetBrains Mono, monospace",
                    color: color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 16,
            color: INK_MUTE,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ display: "flex" }}>
            Historical probability tracking · Fed + ECB
          </div>
          <div style={{ display: "flex" }}>rateradar-web.vercel.app</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: ogFonts,
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    },
  );
}
