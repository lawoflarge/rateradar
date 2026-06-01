"use client";

import { useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ad-slots";

/**
 * Dismissible sticky-anchor ad pinned to the bottom of the viewport. Reserves
 * height to avoid layout shift, never obscures more than a thin strip, and is
 * fully suppressed inside the iOS WebView (AdSlot returns null there, and the
 * wrapper also bails). Renders nothing until the anchor AdSense unit id is set.
 */
export function StickyAnchorAd() {
  const [dismissed, setDismissed] = useState(false);
  const isNativeApp =
    typeof window !== "undefined" && window.NATIVE_PLATFORM === "ios";
  if (dismissed || isNativeApp || !AD_SLOTS.anchor) return null;

  return (
    <>
      {/* In-flow spacer reserves space for the fixed bar so it never covers
          page content; only present while the anchor is shown. */}
      <div aria-hidden className="h-[56px]" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-cream/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-5xl items-center justify-center px-2 py-1">
        <button
          type="button"
          aria-label="Dismiss ad"
          onClick={() => setDismissed(true)}
          className="absolute right-1 top-1 z-10 px-1.5 text-xs text-ink-mute hover:text-ink"
        >
          ✕
        </button>
        <div className="min-h-[50px] w-full">
          <AdSlot
            slot={AD_SLOTS.anchor}
            format="horizontal"
            style={{ display: "block", minHeight: 50 }}
          />
        </div>
      </div>
      </div>
    </>
  );
}
