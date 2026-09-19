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

  test.each([
    ["prefecture", { city: "Chiyoda City", town: "Chiyoda" }],
    ["city", { prefecture: "Tokyo", town: "Chiyoda" }],
    ["town", { prefecture: "Tokyo", city: "Chiyoda City" }],
  ])("rejects an address missing %s", (_field, address) => {
    const result = addressSchema.safeParse(address);

    expect(result.success).toBe(false);
  });

  test.each([
    ["prefecture", { prefecture: 13, city: "Chiyoda City", town: "Chiyoda" }],
    ["city", { prefecture: "Tokyo", city: 100, town: "Chiyoda" }],
    ["town", { prefecture: "Tokyo", city: "Chiyoda City", town: null }],
  ])("rejects an address whose %s is not a string", (_field, address) => {
    const result = addressSchema.safeParse(address);

    expect(result.success).toBe(false);
  });
});
