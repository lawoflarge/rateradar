import { StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";

import { getBannerUnitId, isAdsEnabled } from "@/lib/ads";

export function BannerAdSlot({ testID }: { testID?: string }) {
  if (!isAdsEnabled()) {
    return (
      <View testID={testID ?? "rr-banner-disabled"} style={styles.disabled} />
    );
  }
  return (
    <View testID={testID ?? "rr-banner"} style={styles.container}>
      <BannerAd
        unitId={getBannerUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: { height: 0, width: 0 },
  container: { alignItems: "center", backgroundColor: "#F5F1E8" },
});
