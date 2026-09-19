import { describe, expect, test } from "vitest";
import { apiErrorResponseSchema } from "../index.ts";

describe("apiErrorResponseSchema", () => {
  test.each([
    "INVALID_REQUEST",
    "NOT_FOUND",
    "METHOD_NOT_ALLOWED",
    "DATA_UNAVAILABLE",
    "INTERNAL_ERROR",
  ])("accepts an error response whose code is %s", (code) => {
    const result = apiErrorResponseSchema.safeParse({
      error: {
        code,
        message: "Postal code data is temporarily unavailable.",
        requestId: "01JEXAMPLE0000000000000000",
      },
    });

    expect(result.success).toBe(true);
  });
});
