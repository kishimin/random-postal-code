import { afterEach, describe, expect, test, vi } from "vitest";
import { pickRandomIndex } from "./pick-random-index.ts";

/*
 * api-design.md section 5: "Random selection uses an unbiased integer in
 * [0, count). Implementations must avoid rounding an inclusive upper bound
 * and must not sample source rows." These are the deterministic boundary
 * tests the Issue #4 acceptance test's own comment defers to the inner loop:
 * whether the first and last indices are reachable, driven by controlling
 * Math.random directly rather than by statistics over many draws.
 */
describe("pickRandomIndex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("picks index 0 when Math.random reports its lowest possible value", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(pickRandomIndex(5)).toBe(0);
  });

  test("picks the last valid index when Math.random reports a value just below 1, without rounding up to count", () => {
    // The closest a real Math.random() call can get to 1 without reaching
    // it. Rounding this up to `count` instead of flooring it to `count - 1`
    // would make the last entry unreachable and the count-th index invalid.
    vi.spyOn(Math, "random").mockReturnValue(1 - Number.EPSILON);

    expect(pickRandomIndex(5)).toBe(4);
  });
});
