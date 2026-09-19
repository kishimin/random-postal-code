import { describe, expect, test } from "vitest";
import { apiErrorResponseSchema } from "../index.ts";

const validCode = "NOT_FOUND";
const message = "Postal code data is temporarily unavailable.";
const requestId = "01JEXAMPLE0000000000000000";

describe("apiErrorResponseSchema", () => {
  test.each([
    "INVALID_REQUEST",
    "NOT_FOUND",
    "METHOD_NOT_ALLOWED",
    "DATA_UNAVAILABLE",
    "INTERNAL_ERROR",
  ])("accepts an error response whose code is %s", (code) => {
    const input = { error: { code, message, requestId } };
    const result = apiErrorResponseSchema.safeParse(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  test("rejects an error response whose code is not one of the defined values", () => {
    const result = apiErrorResponseSchema.safeParse({
      error: { code: "UNKNOWN_CODE", message, requestId },
    });

    expect(result.success).toBe(false);
  });

  test.each([
    ["message", { code: validCode, requestId }],
    ["requestId", { code: validCode, message }],
  ])("rejects an error response missing %s", (_field, error) => {
    const result = apiErrorResponseSchema.safeParse({ error });

    expect(result.success).toBe(false);
  });

  test.each([
    ["message", { code: validCode, message: 42, requestId }],
    ["requestId", { code: validCode, message, requestId: null }],
  ])("rejects an error response whose %s is not a string", (_field, error) => {
    const result = apiErrorResponseSchema.safeParse({ error });

    expect(result.success).toBe(false);
  });

  test("rejects a response missing the error key entirely", () => {
    const result = apiErrorResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
