import { describe, expect, test } from "vitest";
import { apiErrorResponseSchema } from "../index.ts";

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
    const result = apiErrorResponseSchema.safeParse({
      error: { code, message, requestId },
    });

    expect(result.success).toBe(true);
  });

  test("rejects an error response whose code is not one of the defined values", () => {
    const result = apiErrorResponseSchema.safeParse({
      error: { code: "UNKNOWN_CODE", message, requestId },
    });

    expect(result.success).toBe(false);
  });
});
