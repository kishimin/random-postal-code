import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { useGenerator } from "./use-generator";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("useGenerator", () => {
  test("refuses a second generation started before the next render", async () => {
    // Never settles, so the first request stays in flight.
    const request = jest.fn<typeof fetch>(() => new Promise(() => undefined));
    globalThis.fetch = request;
    const { result } = await renderHook(() =>
      useGenerator("https://api.example.test"),
    );

    // Both calls land in one act, before React re-renders with "loading":
    // only the ref can refuse the second, which is what a fast double tap
    // does on a device.
    await act(() => {
      result.current.generate();
      result.current.generate();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("loading");
  });
});
