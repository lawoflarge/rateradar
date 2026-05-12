jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboardingStore";

const mocked = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("onboardingStore", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns true when key is '1'", async () => {
    mocked.getItem.mockResolvedValue("1");
    expect(await hasCompletedOnboarding()).toBe(true);
  });

  it("returns false when key is missing", async () => {
    mocked.getItem.mockResolvedValue(null);
    expect(await hasCompletedOnboarding()).toBe(false);
  });

  it("returns false on storage error", async () => {
    mocked.getItem.mockRejectedValue(new Error("oops"));
    expect(await hasCompletedOnboarding()).toBe(false);
  });

  it("marks complete via key '1'", async () => {
    await markOnboardingComplete();
    expect(mocked.setItem).toHaveBeenCalledWith("rr.onboarding.completed.v1", "1");
  });
});
