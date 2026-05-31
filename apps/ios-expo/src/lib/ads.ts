import mobileAds, {
  MaxAdContentRating,
  AdsConsent,
  AdsConsentStatus,
} from "react-native-google-mobile-ads";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { Platform } from "react-native";

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

// Google's official iOS test interstitial. Replace via env once a real
// Interstitial unit is created in admob.google.com → RateRadar app.
const TEST_INTERSTITIAL_UNIT_ID = "ca-app-pub-3940256099942544/4411468910";

const INTERSTITIAL_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID ||
  TEST_INTERSTITIAL_UNIT_ID;

export function getInterstitialUnitId(): string {
  return INTERSTITIAL_UNIT_ID;
}

let initialized = false;

export async function initAds(): Promise<void> {
  if (!ENABLED || initialized) return;
  initialized = true;

  // Request App Tracking Transparency before any ad loads. App.tsx fires this
  // only once the app is foreground-active — iOS silently no-ops the prompt if
  // it is requested during the cold-launch splash, which was the cause of the
  // Guideline 2.1 rejection where App Review never saw the prompt.
  if (Platform.OS === "ios") {
    try {
      const { status } = await getTrackingPermissionsAsync();
      if (status === "undetermined") {
        await requestTrackingPermissionsAsync();
      }
    } catch {}
  }

  // EEA consent (UMP): show the Google-hosted consent form when required.
  try {
    const consentInfo = await AdsConsent.requestInfoUpdate();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdsConsentStatus.REQUIRED
    ) {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }
  } catch {}

  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
}
