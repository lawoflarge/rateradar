import { AppState, AppStateStatus } from "react-native";
import { renderHook } from "@testing-library/react-native";

import { useAppStatePause } from "@/hooks/useAppStatePause";

describe("useAppStatePause", () => {
  it("calls onPause when state changes to background", () => {
    const onPause = jest.fn();
    const onResume = jest.fn();

    const listeners: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evt: string, cb) => {
      listeners.push(cb as (s: AppStateStatus) => void);
      return { remove: jest.fn() } as any;
    });

    renderHook(() => useAppStatePause(onPause, onResume));

    listeners[0]!("background");
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();

    listeners[0]!("active");
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
