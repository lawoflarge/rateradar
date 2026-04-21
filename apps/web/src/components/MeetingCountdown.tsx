"use client";

import { useSyncExternalStore } from "react";

interface Props {
  meetingDate: string; // ISO date (YYYY-MM-DD)
}

function computeLabel(meetingDate: string): string {
  const target = new Date(meetingDate + "T00:00:00").getTime();
  const now = Date.now();
  const days = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
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
  const label = useSyncExternalStore(
    subscribe,
    () => computeLabel(meetingDate),
    () => "",
  );
  return <span suppressHydrationWarning>{label}</span>;
}
