import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { createApp } from "./app.ts";

/*
 * Composition-root-level coverage of createApp's own routing and HTTP
 * mapping, one layer below the Issue #4 acceptance test that drives the
 * same behavior through the deployed Worker's entry point. Kept here so a
 * routing regression is caught by this package's own fast suite rather than
 * only by the slower acceptance test in acceptance/.
 */
const onlyPostalCode: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const appServing = (postalCodes: readonly PostalCode[]) =>
  createApp({
    postalCodeRepository: { listPostalCodes: async () => postalCodes },
  });

describe("createApp", () => {
  test("answers GET /api/random with 200, the JSON content type, no-store caching, and the selected postal code", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual(onlyPostalCode);
  });
});
