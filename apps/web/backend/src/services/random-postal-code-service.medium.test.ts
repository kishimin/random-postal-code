import { postalCodeSchema, type PostalCode } from "@zipnami/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { selectRandomPostalCode } from "./random-postal-code-service.ts";

const postalCode = (code: string): PostalCode => ({
  postalCode: code,
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
});

/*
 * Unit-level coverage of the service api-design.md section 5 names
 * `RandomPostalCodeService`: it selects over the repository's collection and
 * classifies the collection's usability, one layer below the HTTP status
 * codes a controller later maps these outcomes to.
 */
describe("selectRandomPostalCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("selects the postal code at the uniformly random index the repository's collection holds", async () => {
    const first = postalCode("1000001");
    const second = postalCode("1000005");
    // Forces pickRandomIndex(2) to choose index 1, so a correct selection
    // returns `second` and an implementation that ignored the index (for
    // example always returning the first entry) is caught.
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    const result = await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve([first, second]),
    });

    expect(result).toEqual({ outcome: "ok", postalCode: second });
  });

  test("reports dataUnavailable when the repository's collection is empty", async () => {
    const result = await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve([]),
    });

    expect(result).toEqual({ outcome: "dataUnavailable" });
  });

  test("reports dataUnavailable when an entry in the repository's collection fails the shared postal code contract", async () => {
    const corrupt = [
      { postalCode: "not-a-postal-code", addresses: [] },
      postalCode("1000001"),
    ] as unknown as readonly PostalCode[];

    const result = await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve(corrupt),
    });

    expect(result).toEqual({ outcome: "dataUnavailable" });
  });

  test("reports internalError, rather than throwing, when the repository rejects", async () => {
    const result = await selectRandomPostalCode({
      listPostalCodes: () =>
        Promise.reject(new Error("the data layer let this escape")),
    });

    expect(result).toEqual({ outcome: "internalError" });
  });

  // The whole collection was re-validated with Zod on every request. At
  // production dataset sizes
  // (Issue #34) that is tens of milliseconds of duplicate CPU per request,
  // over work `GeneratedDatasetRepository` already did once at module
  // evaluation. The fix memoizes the verdict per collection reference rather
  // than dropping entry-level validation, which the "fails the shared postal
  // code contract" test above still requires.
  test("does not re-run per-entry validation for a collection reference it has already validated", async () => {
    const postalCodes = [postalCode("1000001")];
    const parseSpy = vi.spyOn(postalCodeSchema, "safeParse");

    await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve(postalCodes),
    });
    const callsAfterFirstRequest = parseSpy.mock.calls.length;

    // Sanity: the first request must have actually validated the entry: a
    // memoization bug that skipped validation entirely would also leave this
    // count unchanged and should not be mistaken for a passing test.
    expect(callsAfterFirstRequest).toBeGreaterThan(0);

    await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve(postalCodes),
    });

    expect(parseSpy.mock.calls.length).toBe(callsAfterFirstRequest);
  });

  // `postalCodes[index]` is typed as non-optional without
  // `noUncheckedIndexedAccess`, so nothing
  // stops a future edit from returning `{ outcome: "ok", postalCode:
  // undefined }`. A sparse array reproduces this today without any code
  // change: `Array.prototype.every` skips holes, so `isUsableCollection`
  // reports a collection with a hole as usable, while indexing into the hole
  // yields `undefined`.
  test("reports internalError rather than a malformed ok result when the selected index lands on a hole in the collection", async () => {
    const sparse: PostalCode[] = [postalCode("1000001")];
    sparse.length = 2; // Index 1 is a genuine hole, not an explicit undefined.
    // Forces pickRandomIndex(2) to choose index 1, the hole.
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    const result = await selectRandomPostalCode({
      listPostalCodes: () => Promise.resolve(sparse),
    });

    expect(result).toEqual({ outcome: "internalError" });
  });
});
