import { apiErrorResponseSchema, type PostalCode } from "@zipnami/shared";
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

/** Parses a response body as the shared error envelope, not as `unknown`. */
const errorBodyOf = async (response: Response) =>
  apiErrorResponseSchema.parse(await response.json());

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

  test("answers each request with its own non-empty x-request-id header, differing between requests", async () => {
    const app = appServing([onlyPostalCode]);

    const first = await app.request("/api/random");
    const second = await app.request("/api/random");

    const firstId = first.headers.get("x-request-id");
    const secondId = second.headers.get("x-request-id");

    expect(firstId ?? "").not.toBe("");
    expect(secondId ?? "").not.toBe("");
    expect(secondId).not.toBe(firstId);
  });

  test("answers a query parameter on /api/random with 400 INVALID_REQUEST, correlating the header and body request ids", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random?postalCode=1000001");
    const body = await errorBodyOf(response);

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  test("answers POST /api/random with 405 METHOD_NOT_ALLOWED", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", { method: "POST" });
    const body = await errorBodyOf(response);

    expect(response.status).toBe(405);
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  test("answers an unmatched path with 404 NOT_FOUND in the JSON error envelope, not Hono's default page", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/unknown");
    const body = await errorBodyOf(response);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("answers 503 DATA_UNAVAILABLE when the repository's collection cannot be served", async () => {
    const app = appServing([]);

    const response = await app.request("/api/random");
    const body = await errorBodyOf(response);

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("DATA_UNAVAILABLE");
  });

  test("answers 500 INTERNAL_ERROR without leaking the underlying failure's message when the repository rejects", async () => {
    const secret = "some-internal-detail-that-must-not-leak";
    const app = createApp({
      postalCodeRepository: {
        listPostalCodes: async () => {
          throw new Error(secret);
        },
      },
    });

    const response = await app.request("/api/random");
    const text = await response.clone().text();
    const body = await errorBodyOf(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain(secret);
  });
});
