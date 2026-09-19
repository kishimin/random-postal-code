import { describe, expect, test } from "vitest";
import { postalCodeSchema } from "../index.ts";

describe("postalCodeSchema", () => {
  test("accepts a seven-digit postalCode with a non-empty addresses array", () => {
    const result = postalCodeSchema.safeParse({
      postalCode: "1000001",
      addresses: [
        {
          prefecture: "Tokyo",
          city: "Chiyoda City",
          town: "Chiyoda",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test("rejects a PostalCode whose addresses array is empty", () => {
    const result = postalCodeSchema.safeParse({
      postalCode: "1000001",
      addresses: [],
    });

    expect(result.success).toBe(false);
  });

  test.each([
    ["too short", "100001"],
    ["too long", "10000011"],
    ["non-digit characters", "100000a"],
  ])("rejects a postalCode that is %s", (_reason, postalCode) => {
    const result = postalCodeSchema.safeParse({
      postalCode,
      addresses: [
        {
          prefecture: "Tokyo",
          city: "Chiyoda City",
          town: "Chiyoda",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
