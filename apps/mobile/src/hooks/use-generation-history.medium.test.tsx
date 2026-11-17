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
    const { result } = await renderHook(() => useGenerationHistory());

    await act(() => {
      result.current.record(resultOf(2));
    });
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
});
