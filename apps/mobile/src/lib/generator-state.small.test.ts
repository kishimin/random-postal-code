import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import {
  generatorReducer,
  initialGeneratorState,
  shownResultOf,
  type GeneratorState,
} from "./generator-state";

const tokyo: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const sapporo: PostalCode = {
  postalCode: "0600000",
  addresses: [{ prefecture: "北海道", city: "札幌市中央区", town: "大通西" }],
};

const success: GeneratorState = { status: "success", result: tokyo };

describe("generatorReducer", () => {
  test("starts with nothing shown", () => {
    expect(shownResultOf(initialGeneratorState)).toBeUndefined();
  });

  test("keeps the shown result while the next one loads", () => {
    const loading = generatorReducer(success, { type: "started" });

    expect(loading).toEqual({ status: "loading", previous: tokyo });
    expect(shownResultOf(loading)).toBe(tokyo);
  });

  test("replaces the shown result with the new one", () => {
    const loading = generatorReducer(success, { type: "started" });
    const next = generatorReducer(loading, {
      type: "succeeded",
      result: sapporo,
    });

    expect(shownResultOf(next)).toBe(sapporo);
  });

  test("keeps the shown result when the next one fails", () => {
    const loading = generatorReducer(success, { type: "started" });
    const failed = generatorReducer(loading, {
      type: "failed",
      failure: "offline",
    });

    expect(failed).toEqual({
      status: "error",
      failure: "offline",
      previous: tokyo,
    });
    expect(shownResultOf(failed)).toBe(tokyo);
  });

  test("shows nothing after a first generation fails", () => {
    const loading = generatorReducer(initialGeneratorState, {
      type: "started",
    });
    const failed = generatorReducer(loading, {
      type: "failed",
      failure: "service-unavailable",
    });

    expect(shownResultOf(failed)).toBeUndefined();
  });

  test("keeps an earlier result through a retry after a failure", () => {
    const failed: GeneratorState = {
      status: "error",
      failure: "offline",
      previous: tokyo,
    };

    expect(shownResultOf(generatorReducer(failed, { type: "started" }))).toBe(
      tokyo,
    );
  });
});
