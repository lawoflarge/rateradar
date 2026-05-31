import {
  InterstitialAd,
  AdEventType,
} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getInterstitialUnitId, isAdsEnabled } from "@/lib/ads";
import { shouldShow, FreqState } from "@/lib/interstitialPolicy";

const LAST_SHOWN_KEY = "rr.interstitial.lastShownTs.v1";

let ad: InterstitialAd | null = null;
let adLoaded = false;
let count = 0; // qualifying events this session (in-memory)
let shownThisSession = 0; // in-memory
let lastShownTs = 0; // epoch ms, hydrated from AsyncStorage once
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const v = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    if (v) lastShownTs = parseInt(v, 10) || 0;
  } catch {
    // ignore — defaults to 0 (no floor on first run)
  }
}

export async function preloadInterstitial(): Promise<void> {
  if (!isAdsEnabled()) return;
  await hydrate();

  ad = InterstitialAd.createForAdRequest(getInterstitialUnitId(), {
    requestNonPersonalizedAdsOnly: false,
  });
  adLoaded = false;

  ad.addAdEventListener(AdEventType.LOADED, () => {
    adLoaded = true;
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    adLoaded = false;
    shownThisSession += 1;
    lastShownTs = Date.now();
    AsyncStorage.setItem(LAST_SHOWN_KEY, String(lastShownTs)).catch(() => {});
    preloadInterstitial().catch(() => {}); // reload for next time
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    adLoaded = false;
  });

  try {
    ad.load();
  } catch {
    // ignore — will retry on next qualifying event
  }
}

export async function onQualifyingEvent(_route: string): Promise<void> {
  if (!isAdsEnabled()) return;
  count += 1;
  const state: FreqState = { count, shownThisSession, lastShownTs, adLoaded };
  if (shouldShow(state, Date.now())) {
    try {
      ad?.show();
    } catch {
      // ignore — never block navigation on an ad error
    }
  } else if (!adLoaded && !ad) {
    preloadInterstitial().catch(() => {});
  }
}
