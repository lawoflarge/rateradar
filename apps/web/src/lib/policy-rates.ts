/**
 * Current policy-rate midpoints, used as the anchor for computing implied
 * forward rate curves. Updated manually when central banks change rates; the
 * pipeline can also derive these from live data once fully hooked up.
 *
 * FED: 3.50-3.75% target range → midpoint 3.625% (since 2026-04-29)
 * ECB: 2.00% deposit facility rate (DFR) (as of Apr 2026)
 */

import type { BankCode } from "./types";

export const CURRENT_POLICY_RATES: Record<BankCode, number> = {
  FED: 3.625,
  ECB: 2.0,
};

export const CURRENT_POLICY_RATE_LABELS: Record<BankCode, string> = {
  FED: "Fed Funds target range 3.50–3.75%",
  ECB: "ECB Deposit Facility Rate 2.00%",
};
