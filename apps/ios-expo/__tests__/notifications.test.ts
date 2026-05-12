jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

import * as Notifications from "expo-notifications";

import { getApnsToken, getPushStatus, requestPushPermission } from "@/lib/notifications";

const mocked = Notifications as jest.Mocked<typeof Notifications>;

describe("notifications adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports granted when permissions are granted", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "granted" } as any);
    expect(await getPushStatus()).toBe("granted");
  });

  it("reports undetermined when status is unknown", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "undetermined" } as any);
    expect(await getPushStatus()).toBe("undetermined");
  });

  it("requests permission with iOS-specific options", async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({ status: "granted" } as any);
    const result = await requestPushPermission();
    expect(result).toBe("granted");
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledWith(
      expect.objectContaining({ ios: expect.any(Object) }),
    );
  });

  it("returns APNs token string when available", async () => {
    mocked.getDevicePushTokenAsync.mockResolvedValue({ type: "ios", data: "abc123" } as any);
    expect(await getApnsToken()).toBe("abc123");
  });

  it("returns null when token retrieval throws", async () => {
    mocked.getDevicePushTokenAsync.mockRejectedValue(new Error("boom"));
    expect(await getApnsToken()).toBeNull();
  });
});
