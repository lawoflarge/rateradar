"use client";

import { useSyncExternalStore } from "react";

interface Props {
  meetingDate: string; // ISO date (YYYY-MM-DD)
}

function computeLabel(meetingDate: string): { prefix: string; value: string; suffix: string } {
  const target = new Date(meetingDate + "T00:00:00").getTime();
  const now = Date.now();
  const days = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  if (days === 0) return { prefix: "", value: "", suffix: "Today" };
  if (days === 1) return { prefix: "", value: "", suffix: "Tomorrow" };
  return { prefix: "in ", value: String(days), suffix: " days" };
}

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
    () => ({ prefix: "", value: "", suffix: "" }),
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
