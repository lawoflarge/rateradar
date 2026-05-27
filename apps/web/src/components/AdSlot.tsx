"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    NATIVE_PLATFORM?: string;
  }
}

interface AdSlotProps {
  slot: string;
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  layout?: string;
  layoutKey?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function AdSlot({
  slot,
  format = "auto",
  layout,
  layoutKey,
  responsive = true,
  className,
  style,
}: AdSlotProps) {
  const pushed = useRef(false);
  const isNativeApp =
    typeof window !== "undefined" && window.NATIVE_PLATFORM === "ios";

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || pushed.current || isNativeApp) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle not loaded yet; will retry on next mount
    }
  }, [isNativeApp]);

  if (!ADSENSE_CLIENT_ID || isNativeApp) return null;

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`.trim()}
      style={style ?? { display: "block" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
