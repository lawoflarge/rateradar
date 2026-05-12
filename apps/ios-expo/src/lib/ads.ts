const ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";

export function isAdsEnabled(): boolean {
  return ENABLED;
}

// Returns null in v1.0. When ads ship in v1.0.x, swap the implementation to load
// react-native-google-mobile-ads dynamically and return a BannerAd component.
export function getBannerComponent(): null {
  return null;
}
