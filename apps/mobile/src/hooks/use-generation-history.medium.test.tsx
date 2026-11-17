import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PostalCode } from "@zipnami/shared";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { HISTORY_STORAGE_KEY } from "../lib/generation-history";
import { useGenerationHistory } from "./use-generation-history";

const resultOf = (index: number): PostalCode => ({
  postalCode: `90000${String(index).padStart(2, "0")}`,
  addresses: [{ prefecture: "沖縄県", city: "那覇市", town: `町${index}` }],
});

const stored = async (): Promise<unknown> => {
  const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as unknown);
};

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

describe("useGenerationHistory", () => {
  test("starts with the history stored on the device", async () => {
    await AsyncStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([resultOf(2), resultOf(1)]),
    );

    const { result } = await renderHook(() => useGenerationHistory());

    await waitFor(() => {
      expect(result.current.history).toEqual([resultOf(2), resultOf(1)]);
    });
  });

  test("records a result first and writes the history to the device", async () => {
    const { result } = await renderHook(() => useGenerationHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(() => {
      result.current.record(resultOf(1));
    });
    await act(() => {
      result.current.record(resultOf(2));
    });

    expect(result.current.history).toEqual([resultOf(2), resultOf(1)]);
    await waitFor(async () => {
      expect(await stored()).toEqual([resultOf(2), resultOf(1)]);
    });
  });

  test("discards a corrupt stored value and still records", async () => {
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, "{not json");
    const { result } = await renderHook(() => useGenerationHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.history).toEqual([]);
    await act(() => {
      result.current.record(resultOf(1));
    });

    expect(result.current.history).toEqual([resultOf(1)]);
  });

  test("keeps a result made before the stored history finished loading", async () => {
    const earlier = JSON.stringify([resultOf(1)]);
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Only the hook's first read is slow. The library's mock is already a
    // jest.fn, so the stored value is answered here rather than delegated
    // back to it, and later reads fall through to the real mock storage.
    jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(async () => {
      await slow;
      return earlier;
    });
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    const { result } = await renderHook(() => useGenerationHistory());

    await act(() => {
      result.current.record(resultOf(2));
    });
    // A write now would replace the stored history with this one result.
    expect(setItem).not.toHaveBeenCalled();
    expect(await stored()).toBeNull();
    await act(async () => {
      release();
      await slow;
    });

    await waitFor(() => {
      expect(result.current.history).toEqual([resultOf(2), resultOf(1)]);
    });
    await waitFor(async () => {
      expect(await stored()).toEqual([resultOf(2), resultOf(1)]);
    });
  });

  test("never writes after the stored history could not be read", async () => {
    const earlier = JSON.stringify([resultOf(1)]);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, earlier);
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("storage unavailable"));
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    // The library's mock keeps the calls made while seeding the storage.
    setItem.mockClear();

    const { result } = await renderHook(() => useGenerationHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    await act(() => {
      result.current.record(resultOf(2));
    });

    // The result is kept for this session only; what is stored is untouched.
    expect(result.current.history).toEqual([resultOf(2)]);
    expect(setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(HISTORY_STORAGE_KEY)).toBe(earlier);
  });

  test("keeps the history on screen when a write fails", async () => {
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValue(new Error("disk full"));
    const { result } = await renderHook(() => useGenerationHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(() => {
      result.current.record(resultOf(1));
    });
    await act(() => {
      result.current.record(resultOf(2));
    });

    expect(result.current.history).toEqual([resultOf(2), resultOf(1)]);
  });

  test("recording sends nothing over the network", async () => {
    const request = jest.fn<typeof fetch>();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = request;
    // The Jest environment has no XMLHttpRequest, so a stand-in is installed:
    // a request would have to construct one before calling its open().
    const xhr = jest.fn();
    Object.defineProperty(globalThis, "XMLHttpRequest", {
      value: xhr,
      configurable: true,
      writable: true,
    });
    try {
      const { result } = await renderHook(() => useGenerationHistory());
      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      await act(() => {
        result.current.record(resultOf(1));
      });

      expect(request).not.toHaveBeenCalled();
      expect(xhr).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      Reflect.deleteProperty(globalThis, "XMLHttpRequest");
    }
  });
});
