import { useCallback, useEffect, useRef } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { useAppStatePause } from "@/hooks/useAppStatePause";
import { WebViewHost, WebViewHandle } from "@/WebViewHost";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const webRef = useRef<WebViewHandle | null>(null);

  const pause = useCallback(() => webRef.current?.pause(), []);
  const resume = useCallback(() => webRef.current?.resume(), []);

  useAppStatePause(pause, resume);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => {});
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  const onFirstPaint = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <WebViewHost ref={webRef} onLoadEnd={onFirstPaint} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F1E8" },
});
