import type { PostalCode } from "@zipnami/shared";
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
      listPostalCodes: async () => [first, second],
    });

    expect(result).toEqual({ outcome: "ok", postalCode: second });
  });

  test("reports dataUnavailable when the repository's collection is empty", async () => {
    const result = await selectRandomPostalCode({
      listPostalCodes: async () => [],
    });

    expect(result).toEqual({ outcome: "dataUnavailable" });
  });

  test("reports dataUnavailable when an entry in the repository's collection fails the shared postal code contract", async () => {
    const corrupt = [
      { postalCode: "not-a-postal-code", addresses: [] },
      postalCode("1000001"),
    ] as unknown as readonly PostalCode[];

    const result = await selectRandomPostalCode({
      listPostalCodes: async () => corrupt,
    });

    expect(result).toEqual({ outcome: "dataUnavailable" });
  });

  test("reports internalError, rather than throwing, when the repository rejects", async () => {
    const result = await selectRandomPostalCode({
      listPostalCodes: async () => {
        throw new Error("the data layer let this escape");
      },
    });

    expect(result).toEqual({ outcome: "internalError" });
  });
});
