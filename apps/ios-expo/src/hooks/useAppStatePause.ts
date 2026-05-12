import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

type Pauser = () => void;

export function useAppStatePause(onPause: Pauser, onResume?: Pauser) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        onResume?.();
      } else {
        onPause();
      }
    });
    return () => sub.remove();
  }, [onPause, onResume]);
}
