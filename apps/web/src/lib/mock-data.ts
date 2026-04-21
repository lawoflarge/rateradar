/**
 * Mock probability data, structured to match what the Supabase-backed API
 * will return. Lets us build and style the UI without requiring the pipeline
 * or database to be live. Values chosen to produce a sensible demo:
 * gradual cutting path over H2 2026.
 */

import type { MeetingProbabilities } from "./types";

const NOW = new Date().toISOString();

export const MOCK_FED_PROBABILITIES: MeetingProbabilities[] = [
  {
    meeting: {
      id: "fed-2026-04-29",
      bank_code: "FED",
      meeting_date: "2026-04-29",
      status: "scheduled",
    },
    snapshot_at: NOW,
    outcomes: [
      { id: "o1", label: "-50bp", delta_bps: -50, probability: 0.02, post_meeting_rate: 3.875 },
      { id: "o2", label: "-25bp", delta_bps: -25, probability: 0.18, post_meeting_rate: 4.125 },
      { id: "o3", label: "Hold", delta_bps: 0, probability: 0.75, post_meeting_rate: 4.375 },
      { id: "o4", label: "+25bp", delta_bps: 25, probability: 0.05, post_meeting_rate: 4.625 },
      { id: "o5", label: "+50bp", delta_bps: 50, probability: 0.00, post_meeting_rate: 4.875 },
    ],
  },
  {
    meeting: {
      id: "fed-2026-06-17",
      bank_code: "FED",
      meeting_date: "2026-06-17",
      status: "scheduled",
    },
    snapshot_at: NOW,
    outcomes: [
      { id: "o6", label: "-50bp", delta_bps: -50, probability: 0.05, post_meeting_rate: 3.875 },
      { id: "o7", label: "-25bp", delta_bps: -25, probability: 0.55, post_meeting_rate: 4.125 },
      { id: "o8", label: "Hold", delta_bps: 0, probability: 0.38, post_meeting_rate: 4.375 },
      { id: "o9", label: "+25bp", delta_bps: 25, probability: 0.02, post_meeting_rate: 4.625 },
      { id: "o10", label: "+50bp", delta_bps: 50, probability: 0.00, post_meeting_rate: 4.875 },
    ],
  },
  {
    meeting: {
      id: "fed-2026-07-29",
      bank_code: "FED",
      meeting_date: "2026-07-29",
      status: "scheduled",
    },
    snapshot_at: NOW,
    outcomes: [
      { id: "o11", label: "-50bp", delta_bps: -50, probability: 0.10, post_meeting_rate: 3.625 },
      { id: "o12", label: "-25bp", delta_bps: -25, probability: 0.47, post_meeting_rate: 3.875 },
      { id: "o13", label: "Hold", delta_bps: 0, probability: 0.40, post_meeting_rate: 4.125 },
      { id: "o14", label: "+25bp", delta_bps: 25, probability: 0.03, post_meeting_rate: 4.375 },
      { id: "o15", label: "+50bp", delta_bps: 50, probability: 0.00, post_meeting_rate: 4.625 },
    ],
  },
  {
    meeting: {
      id: "fed-2026-09-16",
      bank_code: "FED",
      meeting_date: "2026-09-16",
      status: "scheduled",
    },
    snapshot_at: NOW,
    outcomes: [
      { id: "o16", label: "-50bp", delta_bps: -50, probability: 0.15, post_meeting_rate: 3.375 },
      { id: "o17", label: "-25bp", delta_bps: -25, probability: 0.45, post_meeting_rate: 3.625 },
      { id: "o18", label: "Hold", delta_bps: 0, probability: 0.37, post_meeting_rate: 3.875 },
      { id: "o19", label: "+25bp", delta_bps: 25, probability: 0.03, post_meeting_rate: 4.125 },
      { id: "o20", label: "+50bp", delta_bps: 50, probability: 0.00, post_meeting_rate: 4.375 },
    ],
  },
];
