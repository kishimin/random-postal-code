import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import {
  initialMapSelectionState,
  mapSelectionReducer,
} from "./map-selection-state";

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

describe("initialMapSelectionState", () => {
  // ui-design.md section 5.3: "The first address is the initial map
  // selection."
  test("selects the first address of the given result", () => {
    expect(initialMapSelectionState(firstResult).selectedAddress).toBe(
      firstResult.addresses[0],
    );
  });

  test("selects nothing when there is no result yet", () => {
    expect(initialMapSelectionState(undefined).selectedAddress).toBeUndefined();
  });
});

describe("mapSelectionReducer", () => {
  test("moves the selection to the chosen address", () => {
    const state = initialMapSelectionState(firstResult);

    const next = mapSelectionReducer(state, {
      type: "address-selected",
      address: firstResult.addresses[1],
    });

    expect(next.selectedAddress).toBe(firstResult.addresses[1]);
  });

  // ui-design.md section 5.3: a new result's first address becomes the
  // selection again, the same as the very first result.
  test("resets the selection to the new result's first address when the result changes", () => {
    const state = mapSelectionReducer(initialMapSelectionState(firstResult), {
      type: "address-selected",
      address: firstResult.addresses[1],
    });

    const next = mapSelectionReducer(state, {
      type: "result-changed",
      result: secondResult,
    });

    expect(next.selectedAddress).toBe(secondResult.addresses[0]);
  });

  // Selecting another address changes only the map target (ui-design.md
  // section 5.3), so an unchanged result must not disturb it -- a naive
  // reducer that always reset to addresses[0] on this action would pass
  // every other case above while still breaking selection on every render.
  test("keeps the current selection when the result is reported unchanged", () => {
    const state = mapSelectionReducer(initialMapSelectionState(firstResult), {
      type: "address-selected",
      address: firstResult.addresses[1],
    });

    const next = mapSelectionReducer(state, {
      type: "result-changed",
      result: firstResult,
    });

    expect(next.selectedAddress).toBe(firstResult.addresses[1]);
  });
});
