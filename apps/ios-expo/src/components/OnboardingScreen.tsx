import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getApnsToken, requestPushPermission } from "@/lib/notifications";
import { markOnboardingComplete } from "@/lib/onboardingStore";

interface Props {
  onDone: () => void;
}

const CREAM = "#F5F1E8";
const INK = "#0E0E0E";
const INK_MUTE = "#6F6A60";
const CUT = "#C8841C";

export function OnboardingScreen({ onDone }: Props) {
  const [busy, setBusy] = useState(false);

  const handleEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const status = await requestPushPermission();
      if (status === "granted") {
        await getApnsToken(); // best-effort; result isn't sent anywhere in v1.0
      }
    } finally {
      await markOnboardingComplete();
      setBusy(false);
      onDone();
    }
  }, [busy, onDone]);

  const handleSkip = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await markOnboardingComplete();
    setBusy(false);
    onDone();
  }, [busy, onDone]);

  return (
    <View style={styles.root} testID="rr-onboarding">
      <View style={styles.brandRow}>
        <View style={styles.outer}>
          <View style={styles.mid}>
            <View style={styles.inner} />
          </View>
        </View>
        <Text style={styles.brand}>RateRadar</Text>
      </View>

      <Text style={styles.headline}>When will they cut?</Text>
      <Text style={styles.lede}>
        Market-implied probabilities for Fed and ECB rate decisions, with historical
        tracking over days and weeks.
      </Text>

      <Text style={styles.ctaLabel}>Get a heads-up when odds move sharply.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={handleEnable}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        disabled={busy}
        testID="rr-onboarding-enable"
      >
        <Text style={styles.ctaText}>Enable rate-shift alerts</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={handleSkip}
        style={styles.skip}
        disabled={busy}
        testID="rr-onboarding-skip"
      >
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM, paddingHorizontal: 24, paddingTop: 96, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  outer: { width: 32, height: 32, borderRadius: 16, borderColor: INK, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  mid: { width: 20, height: 20, borderRadius: 10, borderColor: INK, borderWidth: 0.75, alignItems: "center", justifyContent: "center" },
  inner: { width: 8, height: 8, borderRadius: 4, borderColor: INK, borderWidth: 0.75 },
  brand: { fontSize: 18, fontWeight: "600", color: INK, letterSpacing: -0.2 },
  headline: { marginTop: 56, fontSize: 40, fontWeight: "500", color: INK, lineHeight: 44, letterSpacing: -0.6 },
  lede: { marginTop: 16, fontSize: 17, lineHeight: 26, color: INK_MUTE },
  ctaLabel: { marginTop: 64, fontSize: 13, color: INK_MUTE, textTransform: "uppercase", letterSpacing: 1.2 },
  cta: { marginTop: 12, backgroundColor: INK, paddingVertical: 16, alignItems: "center" },
  ctaPressed: { backgroundColor: CUT },
  ctaText: { color: CREAM, fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
  skip: { marginTop: 16, paddingVertical: 12, alignItems: "center" },
  skipText: { color: INK_MUTE, fontSize: 14 },
});
