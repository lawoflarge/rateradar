import mobileAds, {
  MaxAdContentRating,
} from "react-native-google-mobile-ads";

const ENABLED = process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";

// Google's official iOS test banner. Replace via env once a real ad unit is
// created in admob.google.com → RateRadar app → Banner unit.
const TEST_BANNER_UNIT_ID = "ca-app-pub-3940256099942544/2934735716";

const BANNER_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID || TEST_BANNER_UNIT_ID;

export function isAdsEnabled(): boolean {
  return ENABLED;
}

export function getBannerUnitId(): string {
  return BANNER_UNIT_ID;
}

let initialized = false;

export async function initAds(): Promise<void> {
  if (!ENABLED || initialized) return;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
  initialized = true;
}
