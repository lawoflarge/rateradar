"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function qualifyingRoute(path: string): "meeting" | "compare" | null {
  if (path.startsWith("/meeting/")) return "meeting";
  if (path === "/compare") return "compare";
  return null;
}

/**
 * Dumb emitter: when running inside the RateRadar iOS WebView, posts a
 * `rr-nav` message on high-intent navigations so the native layer can decide
 * whether to show an interstitial. No-op in a normal browser.
 */
export function NativeNavBridge() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rn = (
      window as unknown as {
        ReactNativeWebView?: { postMessage: (s: string) => void };
      }
    ).ReactNativeWebView;
    const isIos =
      (window as unknown as { NATIVE_PLATFORM?: string }).NATIVE_PLATFORM ===
      "ios";
    if (!rn || !isIos) return;

    const route = qualifyingRoute(pathname);
    if (!route) return;
    if (lastSent.current === pathname) return; // guard re-fires on same path
    lastSent.current = pathname;

    try {
      rn.postMessage(JSON.stringify({ type: "rr-nav", route }));
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
