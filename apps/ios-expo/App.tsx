import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { useAppStatePause } from "@/hooks/useAppStatePause";
import { BannerAdSlot } from "@/components/BannerAdSlot";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { initAds } from "@/lib/ads";
import { hasCompletedOnboarding } from "@/lib/onboardingStore";
import { WebViewHost, WebViewHandle } from "@/WebViewHost";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const webRef = useRef<WebViewHandle | null>(null);
  const [phase, setPhase] = useState<"loading" | "onboarding" | "web">("loading");

  const pause = useCallback(() => webRef.current?.pause(), []);
  const resume = useCallback(() => webRef.current?.resume(), []);

  useAppStatePause(pause, resume);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => {});
    initAds().catch(() => {});
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    hasCompletedOnboarding()
      .then((done) => {
        setPhase(done ? "web" : "onboarding");
        SplashScreen.hideAsync().catch(() => {});
      })
      .catch(() => {
        setPhase("onboarding");
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  const handleOnboardingDone = useCallback(() => {
    setPhase("web");
  }, []);

  const onFirstPaint = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {phase === "loading" && <View style={styles.empty} />}
      {phase === "onboarding" && <OnboardingScreen onDone={handleOnboardingDone} />}
      {phase === "web" && (
        <>
          <WebViewHost ref={webRef} onLoadEnd={onFirstPaint} />
          <BannerAdSlot />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1E8" },
  empty: { flex: 1, backgroundColor: "#F5F1E8" },
});
