/**
 * Shared types mirroring packages/api-contract/openapi.yaml.
 *
 * Kept in sync by hand for the MVP; can be auto-generated with
 * `openapi-typescript` in Phase 2 once the contract is finalized.
 */

export type BankCode = "FED" | "ECB";

export interface CentralBank {
  id: string;
  code: BankCode;
  name: string;
}

export interface Meeting {
  id: string;
  bank_code: BankCode;
  meeting_date: string; // ISO date (YYYY-MM-DD)
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
}

export interface Outcome {
  id: string;
  label: string; // e.g. "-25bp", "Hold", "+25bp"
  delta_bps: number;
  probability: number; // [0, 1]
  post_meeting_rate: number; // percent, e.g. 4.375
}

export interface MeetingProbabilities {
  meeting: Meeting;
  outcomes: Outcome[];
  snapshot_at: string; // ISO timestamp
}

export interface ProbabilityPoint {
  snapshot_at: string;
  probability: number;
}

export interface ProbabilitySeries {
  outcome_id: string;
  label: string;
  delta_bps: number;
  series: ProbabilityPoint[];
}
