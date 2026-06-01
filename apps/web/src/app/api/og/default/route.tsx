/**
 * Static Open Graph fallback image for the homepage and pages that don't have
 * their own dynamic OG image. Mirrors the meeting OG route's runtime + palette.
 *
 * GET /api/og/default -> 1200x630 PNG
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Wire Room tokens (kept in sync with the meeting OG route + globals.css).
const CREAM = "#F5F1E8";
const INK = "#0E0E0E";
const INK_MUTE = "#6F6A60";
const CUT = "#C8841C";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          backgroundColor: CREAM,
          color: INK,
        }}
      >
        <div
          style={{
            fontSize: 34,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: CUT,
          }}
        >
          RateRadar
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 600,
            marginTop: 28,
            lineHeight: 1.08,
            maxWidth: 980,
          }}
        >
          Fed + ECB rate-decision probabilities
        </div>
        <div style={{ fontSize: 36, marginTop: 28, color: INK_MUTE }}>
          See where rates are headed — before the meeting.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
