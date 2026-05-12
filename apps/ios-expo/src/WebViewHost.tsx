import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { PRE_LOAD_BRIDGE, WEB_BASE_URL } from "@/lib/constants";

export interface WebViewHandle {
  pause: () => void;
  resume: () => void;
  reload: () => void;
}

interface WebViewHostProps {
  source?: string;
  testID?: string;
  onLoadEnd?: () => void;
}

export const WebViewHost = forwardRef<WebViewHandle, WebViewHostProps>(
  function WebViewHost({ source, testID, onLoadEnd }, ref) {
    const webRef = useRef<WebView | null>(null);

    useImperativeHandle(ref, () => ({
      pause: () => {
        webRef.current?.injectJavaScript(
          "try { window.dispatchEvent(new Event('rr-pause')); } catch (e) {} true;",
        );
      },
      resume: () => {
        webRef.current?.injectJavaScript(
          "try { window.dispatchEvent(new Event('rr-resume')); } catch (e) {} true;",
        );
      },
      reload: () => {
        webRef.current?.reload();
      },
    }));

    return (
      <WebView
        ref={webRef}
        testID={testID ?? "rr-webview"}
        source={{ uri: source ?? WEB_BASE_URL }}
        injectedJavaScriptBeforeContentLoaded={PRE_LOAD_BRIDGE}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        decelerationRate="normal"
        bounces
        onLoadEnd={onLoadEnd}
      />
    );
  },
);

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#F5F1E8" },
});
