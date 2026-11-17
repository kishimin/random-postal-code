import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { Linking } from "react-native";
import { useExternalMap } from "./use-external-map";

const address = { prefecture: "東京都", city: "千代田区", town: "千代田" };

let openURL: jest.SpiedFunction<typeof Linking.openURL>;

beforeEach(() => {
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useExternalMap", () => {
  test("hands the encoded Google Maps search to the operating system", async () => {
    const { result } = await renderHook(() => useExternalMap());

    await act(async () => {
      await result.current.open(address);
    });

    expect(openURL).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("東京都千代田区千代田")}`,
    );
    expect(result.current.failed).toBe(false);
  });

  test("reports a failure to open and clears it on request", async () => {
    openURL.mockRejectedValue(new Error("No Activity found to handle Intent"));
    const { result } = await renderHook(() => useExternalMap());

    await act(async () => {
      await result.current.open(address);
    });
    expect(result.current.failed).toBe(true);

    await act(() => {
      result.current.dismiss();
    });
    expect(result.current.failed).toBe(false);
  });

  test("a later success clears an earlier failure", async () => {
    openURL.mockRejectedValueOnce(new Error("Unable to open URL"));
    const { result } = await renderHook(() => useExternalMap());

    await act(async () => {
      await result.current.open(address);
    });
    await act(async () => {
      await result.current.open(address);
    });

    expect(result.current.failed).toBe(false);
  });
});
