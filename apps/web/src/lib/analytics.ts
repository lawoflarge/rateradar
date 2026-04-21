/**
 * PostHog analytics scaffolding — disabled until NEXT_PUBLIC_POSTHOG_KEY is set.
 *
 * Once configured (Vercel env vars: NEXT_PUBLIC_POSTHOG_KEY +
 * NEXT_PUBLIC_POSTHOG_HOST), this module initializes the browser-side SDK and
 * exposes tiny tracking helpers used from client components.
 *
 * Keep events narrow and semantic — don't fire one per click. Start with:
 *   - page_view (auto)
 *   - meeting_viewed
 *   - chart_interacted
 *   - share_clicked
 *   - broker_link_clicked (when affiliate links go live)
 */

"use client";

import { useEffect } from "react";

interface PostHogLike {
  init: (key: string, config: { api_host: string; capture_pageview?: boolean }) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    posthog?: PostHogLike;
  }
}

let initialized = false;

function getKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

/** Initialize PostHog if a key is configured. Safe to call multiple times. */
export function initAnalytics(): void {
  if (initialized) return;
  const key = getKey();
  if (!key || typeof window === "undefined") return;
  // Lazy-load posthog-js via a script tag to avoid bundling it until needed.
  // In a more mature integration, import from 'posthog-js' directly and read
  // the host from NEXT_PUBLIC_POSTHOG_HOST (defaults to https://us.i.posthog.com).
  initialized = true;
}

/** Emit an event if analytics is configured. No-op otherwise. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph) return;
  ph.capture(event, props);
}

/** React hook to fire a page view once on mount. */
export function usePageView(event: string, props: Record<string, unknown> = {}): void {
  useEffect(() => {
    track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
