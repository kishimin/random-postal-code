import { renderHook } from "@testing-library/react";
import type { PostalCode } from "@zipnami/shared";
import { act } from "react";
import { describe, expect, test } from "vitest";
import { useMapSelection } from "./use-map-selection";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [
    { prefecture: "東京都", city: "千代田区", town: "千代田" },
    { prefecture: "東京都", city: "千代田区", town: "丸の内" },
  ],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

describe("useMapSelection", () => {
  test("selects the first address of the given result", () => {
    const { result } = renderHook(() => useMapSelection(firstResult));

    expect(result.current.selectedAddress).toBe(firstResult.addresses[0]);
  });

  test("selectAddress moves the selection to the chosen address", () => {
    const { result } = renderHook(() => useMapSelection(firstResult));

    act(() => {
      result.current.selectAddress(firstResult.addresses[1]);
    });

    expect(result.current.selectedAddress).toBe(firstResult.addresses[1]);
  });

  // ui-design.md section 5.3: a new result's first address becomes the
  // selection again, so a screen composing this hook does not have to reset
  // it itself on every regeneration.
  test("resets the selection to the new result's first address when the result prop changes", () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: PostalCode | undefined }) =>
        useMapSelection(current),
      { initialProps: { current: firstResult } },
    );

    act(() => {
      result.current.selectAddress(firstResult.addresses[1]);
    });

    rerender({ current: secondResult });

    expect(result.current.selectedAddress).toBe(secondResult.addresses[0]);
  });

  // A parent re-rendering for an unrelated reason (ui-design.md section
  // 5.3's own regeneration model re-renders GeneratorView on every state
  // change) passes the same result reference again; that must not be
  // mistaken for a new result and reset a selection the visitor just made.
  test("keeps the selection across a re-render that carries the same result", () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: PostalCode | undefined }) =>
        useMapSelection(current),
      { initialProps: { current: firstResult } },
    );

    act(() => {
      result.current.selectAddress(firstResult.addresses[1]);
    });

    rerender({ current: firstResult });

    expect(result.current.selectedAddress).toBe(firstResult.addresses[1]);
  });
});
