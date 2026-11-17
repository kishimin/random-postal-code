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
      "https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E5%8D%83%E4%BB%A3%E7%94%B0",
    );
    expect(result.current.failed).toBe(false);
  });

  test("opens the map even when canOpenURL says no", async () => {
    // Android 11 and later answer false for https links without a manifest
    // <queries> entry although the link opens, so it is not asked first.
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
    const { result } = await renderHook(() => useExternalMap());

    await act(async () => {
      await result.current.open(address);
    });

    expect(openURL).toHaveBeenCalledTimes(1);
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

  test("counts every failure, also while an earlier one is still shown", async () => {
    openURL.mockRejectedValue(new Error("Unable to open URL"));
    const { result } = await renderHook(() => useExternalMap());

    await act(async () => {
      await result.current.open(address);
    });
    await act(async () => {
      await result.current.open(address);
    });

    expect(result.current.failed).toBe(true);
    expect(result.current.failureCount).toBe(2);
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

  test("an earlier open that fails late does not override a later success", async () => {
    let failEarlier: (reason: Error) => void = () => undefined;
    openURL.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          failEarlier = reject;
        }),
    );
    const { result } = await renderHook(() => useExternalMap());

    let earlier: Promise<void> = Promise.resolve();
    await act(() => {
      earlier = result.current.open(address);
    });
    await act(async () => {
      await result.current.open(address);
    });
    await act(async () => {
      failEarlier(new Error("Unable to open URL"));
      await earlier;
    });

    expect(result.current.failed).toBe(false);
    expect(result.current.failureCount).toBe(0);
  });

  test("an earlier open that succeeds late does not clear a later failure", async () => {
    let succeedEarlier: () => void = () => undefined;
    openURL.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          succeedEarlier = () => {
            resolve();
          };
        }),
    );
    openURL.mockRejectedValueOnce(new Error("Unable to open URL"));
    const { result } = await renderHook(() => useExternalMap());

    let earlier: Promise<void> = Promise.resolve();
    await act(() => {
      earlier = result.current.open(address);
    });
    await act(async () => {
      await result.current.open(address);
    });
    await act(async () => {
      succeedEarlier();
      await earlier;
    });

    expect(result.current.failed).toBe(true);
  });

  test("a failure that arrives after dismissing is ignored", async () => {
    let failEarlier: (reason: Error) => void = () => undefined;
    openURL.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          failEarlier = reject;
        }),
    );
    const { result } = await renderHook(() => useExternalMap());

    let pending: Promise<void> = Promise.resolve();
    await act(() => {
      pending = result.current.open(address);
    });
    await act(() => {
      result.current.dismiss();
    });
    await act(async () => {
      failEarlier(new Error("Unable to open URL"));
      await pending;
    });

    expect(result.current.failed).toBe(false);
  });
});
