import { describe, expect, test } from "vitest";
import { addressSchema } from "../index.ts";

describe("addressSchema", () => {
  test("accepts an address whose prefecture, city, and town are strings", () => {
    const result = addressSchema.safeParse({
      prefecture: "Tokyo",
      city: "Chiyoda City",
      town: "Chiyoda",
    });

    expect(result.success).toBe(true);
  });
});
