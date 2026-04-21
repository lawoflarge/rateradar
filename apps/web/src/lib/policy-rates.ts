/**
 * Current policy-rate midpoints, used as the anchor for computing implied
 * forward rate curves. Updated manually when central banks change rates; the
 * pipeline can also derive these from live data once fully hooked up.
 *
 * FED: 4.25-4.50% target range → midpoint 4.375% (as of Apr 2026)
 * ECB: 2.00% deposit facility rate (DFR) (as of Apr 2026)
 */

import type { BankCode } from "./types";

export const CURRENT_POLICY_RATES: Record<BankCode, number> = {
  FED: 4.375,
  ECB: 2.0,
};

export const CURRENT_POLICY_RATE_LABELS: Record<BankCode, string> = {
  FED: "Fed Funds target range 4.25–4.50%",
  ECB: "ECB Deposit Facility Rate 2.00%",
};
