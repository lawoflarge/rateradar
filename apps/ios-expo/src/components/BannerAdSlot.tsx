import { StyleSheet, View } from "react-native";

import { isAdsEnabled } from "@/lib/ads";

export function BannerAdSlot({ testID }: { testID?: string }) {
  if (!isAdsEnabled()) {
    return <View testID={testID ?? "rr-banner-disabled"} style={styles.disabled} />;
  }
  // v1.0 ships disabled. Implementation lands in v1.0.x when ads enable.
  return <View testID="rr-banner-enabled-placeholder" style={styles.disabled} />;
}

const styles = StyleSheet.create({
  disabled: { height: 0, width: 0 },
});
