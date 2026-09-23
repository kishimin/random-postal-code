import { describe, expect, test } from "vitest";
import { formatPostalCode } from "./format-postal-code";

describe("formatPostalCode", () => {
  test("inserts a hyphen after the third digit of the canonical seven-digit code", () => {
    // ui-design.md section 5.3: displayed as NNN-NNNN while the canonical
    // seven-digit value is what the API and the clipboard carry.
    expect(formatPostalCode("1000001")).toBe("100-0001");
  });
});
