import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import {
  currentResultOf,
  generatorReducer,
  initialGeneratorState,
} from "./generator-state";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

describe("currentResultOf", () => {
  test("returns undefined for the idle state", () => {
    expect(currentResultOf(initialGeneratorState)).toBeUndefined();
  });

  test("returns the result carried by the success state", () => {
    expect(currentResultOf({ status: "success", result: firstResult })).toBe(
      firstResult,
    );
  });

  test("returns the previous result carried by the loading state", () => {
    expect(
      currentResultOf({ status: "loading", previousResult: firstResult }),
    ).toBe(firstResult);
  });

  test("returns the previous result carried by the error state", () => {
    expect(
      currentResultOf({
        status: "error",
        error: { kind: "offline" },
        previousResult: firstResult,
      }),
    ).toBe(firstResult);
  });
});

describe("generatorReducer", () => {
  // ui-design.md section 4: idle shows an empty result region, so starting a
  // generation from idle has nothing to carry forward.
  test("moves from idle to loading with no previous result", () => {
    const next = generatorReducer(initialGeneratorState, {
      type: "generate/started",
    });

    expect(next).toEqual({ status: "loading", previousResult: undefined });
  });

  // ui-design.md section 4: "Loading disables only duplicate generation.
  // Navigation, prior result, and history remain usable" -- the prior
  // result has to survive the transition into loading.
  test("keeps the current result as the previous result when regenerating from success", () => {
    const next = generatorReducer(
      { status: "success", result: firstResult },
      { type: "generate/started" },
    );

    expect(next).toEqual({
      status: "loading",
      previousResult: firstResult,
    });
  });

  test("moves from loading to success with the returned result", () => {
    const next = generatorReducer(
      { status: "loading", previousResult: firstResult },
      { type: "generate/succeeded", result: secondResult },
    );

    expect(next).toEqual({ status: "success", result: secondResult });
  });

  // ui-design.md section 4: "When a prior result exists, it remains visible
  // and is not reinserted into history" on failure.
  test("moves from loading to error while keeping the previous result", () => {
    const next = generatorReducer(
      { status: "loading", previousResult: firstResult },
      { type: "generate/failed", error: { kind: "service-unavailable" } },
    );

    expect(next).toEqual({
      status: "error",
      error: { kind: "service-unavailable" },
      previousResult: firstResult,
    });
  });
});
