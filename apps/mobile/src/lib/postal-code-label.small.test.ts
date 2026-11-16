import { describe, expect, test } from "vitest";
import { formatPostalCode } from "./postal-code-label";

describe("formatPostalCode", () => {
  test("labels seven digits as 〒NNN-NNNN", () => {
    expect(formatPostalCode("1000001")).toBe("〒100-0001");
  });

  test.each(["100-0001", "100001", "10000011", "１０００００１", ""])(
    "gives no label for %j, which the shared contract rejects",
    (value) => {
      expect(formatPostalCode(value)).toBeUndefined();
    },
  );
});
