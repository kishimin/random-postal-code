import { describe, expect, test } from "vitest";
import { ApiRequestError } from "../../../api/api-client";
import { classifyGeneratorError } from "./classify-error";

describe("classifyGeneratorError", () => {
  // api-design.md section 4.2: 503 DATA_UNAVAILABLE is the "retry may
  // succeed after deployment recovery" condition design.md's UiError names
  // "service-unavailable".
  test("classifies a 503 ApiRequestError as service-unavailable, keeping its requestId", () => {
    const error = new ApiRequestError(
      "Postal code data is temporarily unavailable.",
      503,
      "DATA_UNAVAILABLE",
      "01JEXAMPLE0000000000000000",
    );

    expect(classifyGeneratorError(error)).toEqual({
      kind: "service-unavailable",
      requestId: "01JEXAMPLE0000000000000000",
    });
  });

  test("classifies any other ApiRequestError as unexpected, keeping its requestId", () => {
    const error = new ApiRequestError(
      "An unexpected error occurred.",
      500,
      "INTERNAL_ERROR",
      "01JEXAMPLE0000000000000001",
    );

    expect(classifyGeneratorError(error)).toEqual({
      kind: "unexpected",
      requestId: "01JEXAMPLE0000000000000001",
    });
  });

  // fetch() rejects with a TypeError when the request never reached a server
  // (offline, DNS failure, blocked by the network).
  test("classifies a TypeError as offline", () => {
    expect(classifyGeneratorError(new TypeError("Failed to fetch"))).toEqual({
      kind: "offline",
    });
  });

  // postalCodeSchema.parse throws a ZodError (not an ApiRequestError or a
  // TypeError) when a 200 body does not match the contract.
  test("classifies any other error as an invalid response", () => {
    expect(classifyGeneratorError(new Error("unexpected shape"))).toEqual({
      kind: "invalid-response",
    });
  });
});
