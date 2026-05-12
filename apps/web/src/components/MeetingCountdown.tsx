"use client";

import { useSyncExternalStore } from "react";

interface Props {
  meetingDate: string; // ISO date (YYYY-MM-DD)
}

// Cache snapshot objects so identical inputs return identical references.
// useSyncExternalStore compares snapshots with Object.is — without this cache
// every getSnapshot() call returns a fresh object and triggers React error
// #185 (Maximum update depth exceeded) in production.
const SNAPSHOT_CACHE = new Map<string, { prefix: string; value: string; suffix: string }>();

function computeLabel(meetingDate: string): { prefix: string; value: string; suffix: string } {
  const target = new Date(meetingDate + "T00:00:00").getTime();
  const now = Date.now();
  const days = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  const key = `${meetingDate}|${days}`;
  const cached = SNAPSHOT_CACHE.get(key);
  if (cached) return cached;
  let result: { prefix: string; value: string; suffix: string };
  if (days === 0) result = { prefix: "", value: "", suffix: "Today" };
  else if (days === 1) result = { prefix: "", value: "", suffix: "Tomorrow" };
  else result = { prefix: "in ", value: String(days), suffix: " days" };
  SNAPSHOT_CACHE.set(key, result);
  return result;
}

const EMPTY_PARTS = { prefix: "", value: "", suffix: "" };

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

/**
 * Countdown to a meeting date. Uses `useSyncExternalStore` so React 19 stays happy
 * with time-dependent values — server renders an empty string to avoid hydration
 * mismatches, client hydrates with the live countdown.
 */
export function MeetingCountdown({ meetingDate }: Props) {
  const parts = useSyncExternalStore(
    subscribe,
    () => computeLabel(meetingDate),
    () => EMPTY_PARTS,
  );
  return (
    <span suppressHydrationWarning>
      {parts.prefix}
      {parts.value && (
        <span className="font-mono tabular-nums">{parts.value}</span>
      )}
      {parts.suffix}
    </span>
  );
}
