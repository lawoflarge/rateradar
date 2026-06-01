/**
 * AdSense ad-unit slot ids, one per placement for clean per-placement reporting.
 *
 * `home` is the existing live unit. The others read from NEXT_PUBLIC_AD_SLOT_*
 * env vars and default to "" when unset — AdSlot/StickyAnchorAd render nothing
 * for an empty slot, so the placements are inert (no empty <ins>, no policy
 * risk) until the real AdSense units are created and the env vars are set in
 * Vercel. No code change is needed to light them up.
 */
export const AD_SLOTS = {
  home: "4397253039",
  meeting: process.env.NEXT_PUBLIC_AD_SLOT_MEETING ?? "",
  compare: process.env.NEXT_PUBLIC_AD_SLOT_COMPARE ?? "",
  scenarios: process.env.NEXT_PUBLIC_AD_SLOT_SCENARIOS ?? "",
  glossary: process.env.NEXT_PUBLIC_AD_SLOT_GLOSSARY ?? "",
  anchor: process.env.NEXT_PUBLIC_AD_SLOT_ANCHOR ?? "",
} as const;
