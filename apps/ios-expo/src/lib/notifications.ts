import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type PushStatus = "granted" | "denied" | "undetermined";

export async function getPushStatus(): Promise<PushStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function requestPushPermission(): Promise<PushStatus> {
  if (Platform.OS !== "ios") return "denied";
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      provideAppNotificationSettings: true,
    },
  });
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function getApnsToken(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;
  try {
    const tok = await Notifications.getDevicePushTokenAsync();
    return typeof tok.data === "string" ? tok.data : null;
  } catch {
    return null;
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});
