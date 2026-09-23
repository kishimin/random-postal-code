import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { announcementTextOf } from "./announcement";
import { initialGeneratorState } from "./generator-state";

const result: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

describe("announcementTextOf", () => {
  test("is empty for the idle state, which has nothing to announce yet", () => {
    expect(announcementTextOf(initialGeneratorState)).toBe("");
  });

  test("is empty for the loading state, which has nothing new to announce yet", () => {
    expect(
      announcementTextOf({ status: "loading", previousResult: undefined }),
    ).toBe("");
  });

  // ui-design.md section 8: "Announce ... successful results"; the displayed
  // NNN-NNNN form is what a visitor sees, so the announcement names that.
  test("names the displayed postal code for the success state", () => {
    expect(
      announcementTextOf({ status: "success", result }),
    ).toContain("100-0001");
  });

  // ui-design.md section 8: "Announce ... request errors". The exact wording
  // is left to this Issue (section 12); only that something is said matters
  // here.
  test("is non-empty for the error state", () => {
    expect(
      announcementTextOf({
        status: "error",
        error: { kind: "offline" },
        previousResult: undefined,
      }),
    ).not.toBe("");
  });
});
