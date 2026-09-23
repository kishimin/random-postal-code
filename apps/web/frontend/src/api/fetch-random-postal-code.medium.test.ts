import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import {
  ApiRequestError,
  createApiClient,
  fetchRandomPostalCode,
} from "./api-client";
import { worker } from "./mocks/browser";

const client = createApiClient("http://localhost:8787");

describe("fetchRandomPostalCode", () => {
  test("resolves with the postal code the endpoint returns on 200", async () => {
    const body = {
      postalCode: "1000001",
      addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
    };
    worker.use(
      http.get("http://localhost:8787/api/random", () =>
        HttpResponse.json(body),
      ),
    );

    await expect(fetchRandomPostalCode(client)).resolves.toEqual(body);
  });

  // api-design.md section 4.2: the 503 DATA_UNAVAILABLE envelope.
  test("rejects with an ApiRequestError carrying the error envelope when the endpoint answers 503", async () => {
    worker.use(
      http.get("http://localhost:8787/api/random", () =>
        HttpResponse.json(
          {
            error: {
              code: "DATA_UNAVAILABLE",
              message: "Postal code data is temporarily unavailable.",
              requestId: "01JEXAMPLE0000000000000000",
            },
          },
          { status: 503 },
        ),
      ),
    );

    const rejection: unknown = await fetchRandomPostalCode(client).catch(
      (error: unknown) => error,
    );

    expect(rejection).toBeInstanceOf(ApiRequestError);
    expect(rejection).toMatchObject({
      status: 503,
      code: "DATA_UNAVAILABLE",
      requestId: "01JEXAMPLE0000000000000000",
    });
  });

  test("rejects when the endpoint's 200 body does not match the postal code contract", async () => {
    worker.use(
      http.get("http://localhost:8787/api/random", () =>
        HttpResponse.json({ postalCode: "1000001" }),
      ),
    );

    await expect(fetchRandomPostalCode(client)).rejects.toThrow(/addresses/);
  });

  // api-design.md section 4.1: "an intermediary must not turn repeated
  // generation into a cached result" -- the server states this with its own
  // Cache-Control: no-store response header, but a client that never asks
  // for a fresh fetch is still exposed to a browser (or intervening cache)
  // that serves a stale response for the identical GET /api/random URL
  // heuristically, independent of what the response header says. Requesting
  // `cache: "no-store"` from the client side closes that gap regardless of
  // what any layer between it and the server does.
  test("requests a fresh response every time, never a cached one", async () => {
    const observed: { cacheMode?: RequestCache } = {};
    worker.use(
      http.get("http://localhost:8787/api/random", ({ request }) => {
        observed.cacheMode = request.cache;
        return HttpResponse.json({
          postalCode: "1000001",
          addresses: [
            { prefecture: "東京都", city: "千代田区", town: "千代田" },
          ],
        });
      }),
    );

    await fetchRandomPostalCode(client);

    expect(observed.cacheMode).toBe("no-store");
  });
});
