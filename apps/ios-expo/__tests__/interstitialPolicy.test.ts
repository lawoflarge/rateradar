import { shouldShow, MIN_INTERVAL_MS, SESSION_CAP } from "@/lib/interstitialPolicy";

const base = { count: 3, shownThisSession: 0, lastShownTs: 0, adLoaded: true };
const NOW = MIN_INTERVAL_MS + 1; // far enough past lastShownTs=0

describe("shouldShow", () => {
  it("shows on the 3rd qualifying event when all conditions pass", () => {
    expect(shouldShow(base, NOW)).toBe(true);
  });
  it("does not show on the 1st or 2nd event", () => {
    expect(shouldShow({ ...base, count: 1 }, NOW)).toBe(false);
    expect(shouldShow({ ...base, count: 2 }, NOW)).toBe(false);
  });
  it("shows again on the 6th event", () => {
    expect(shouldShow({ ...base, count: 6 }, NOW)).toBe(true);
  });
  it("blocks when ad not loaded", () => {
    expect(shouldShow({ ...base, adLoaded: false }, NOW)).toBe(false);
  });
  it("blocks within the min interval", () => {
    expect(shouldShow({ ...base, lastShownTs: 100 }, 100 + MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldShow({ ...base, lastShownTs: 100 }, 100 + MIN_INTERVAL_MS)).toBe(true);
  });
  it("blocks once the session cap is reached", () => {
    expect(shouldShow({ ...base, shownThisSession: SESSION_CAP }, NOW)).toBe(false);
  });
  it("never shows at count 0", () => {
    expect(shouldShow({ ...base, count: 0 }, NOW)).toBe(false);
  });
});
