// Pure interstitial frequency policy. NO runtime/native imports so it is
// unit-testable in isolation. The imperative ad lifecycle lives in
// ./interstitial.ts and consumes shouldShow().

export const SHOW_EVERY = 3; // show on every Nth qualifying event
export const MIN_INTERVAL_MS = 180_000; // 180s floor between interstitials
export const SESSION_CAP = 3; // max interstitials per app session

export interface FreqState {
  count: number; // qualifying events seen this session
  shownThisSession: number; // interstitials shown this session
  lastShownTs: number; // epoch ms of last shown (0 if never), persisted
  adLoaded: boolean; // is an interstitial preloaded and ready
}

export function shouldShow(s: FreqState, now: number): boolean {
  return (
    s.adLoaded &&
    s.count > 0 &&
    s.count % SHOW_EVERY === 0 &&
    s.shownThisSession < SESSION_CAP &&
    now - s.lastShownTs >= MIN_INTERVAL_MS
  );
}
