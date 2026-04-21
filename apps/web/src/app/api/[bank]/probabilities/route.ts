/**
 * GET /api/:bank/probabilities    (bank = fed | ecb)
 *
 * Returns current probability snapshots for upcoming meetings of the given bank.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getProbabilities } from "@/lib/data";
import type { BankCode } from "@/lib/types";

const VALID_BANKS: Record<string, BankCode> = {
  fed: "FED",
  ecb: "ECB",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bank: string }> },
) {
  const { bank } = await params;
  const code = VALID_BANKS[bank.toLowerCase()];
  if (!code) {
    return NextResponse.json(
      { error: `Unknown bank '${bank}'. Valid: fed, ecb.` },
      { status: 404 },
    );
  }

  const data = await getProbabilities(code);
  return NextResponse.json(
    { data, bank: code },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
