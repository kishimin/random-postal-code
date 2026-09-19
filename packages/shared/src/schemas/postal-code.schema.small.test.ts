import { describe, expect, expectTypeOf, test } from "vitest";
import { type Address, type PostalCode, postalCodeSchema } from "../index.ts";

const validAddress = {
  prefecture: "Tokyo",
  city: "Chiyoda City",
  town: "Chiyoda",
};

const anotherValidAddress = {
  prefecture: "Osaka",
  city: "Osaka City",
  town: "Umeda",
};

describe("postalCodeSchema", () => {
  test("accepts a seven-digit postalCode with a non-empty addresses array", () => {
    const input = {
      postalCode: "1000001",
      addresses: [validAddress],
    };
    const result = postalCodeSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  test("types addresses as a non-empty tuple, not a plain array", () => {
    expectTypeOf<PostalCode["addresses"]>().toEqualTypeOf<
      [Address, ...Address[]]
    >();
    expectTypeOf<Address[]>().not.toExtend<PostalCode["addresses"]>();
  });

  test("accepts a postalCode with more than one address", () => {
    const result = postalCodeSchema.safeParse({
      postalCode: "1000001",
      addresses: [validAddress, anotherValidAddress],
    });

    expect(result.success).toBe(true);
  });

  test("rejects a PostalCode whose second address is invalid", () => {
    const result = postalCodeSchema.safeParse({
      postalCode: "1000001",
      addresses: [validAddress, { prefecture: "Osaka", city: "Osaka City" }],
    });

    expect(result.success).toBe(false);
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
      addresses: [validAddress],
    });

    expect(result.success).toBe(false);
  });

  test("rejects a postalCode that is a number instead of a string", () => {
    const result = postalCodeSchema.safeParse({
      postalCode: 1000001,
      addresses: [validAddress],
    });

    expect(result.success).toBe(false);
  });
});
