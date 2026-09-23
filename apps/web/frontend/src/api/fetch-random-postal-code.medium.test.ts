import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { worker } from "./mocks/browser";
import { ApiRequestError, createApiClient, fetchRandomPostalCode } from "./api-client";

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

    await expect(fetchRandomPostalCode(client)).rejects.toThrow();
  });
});
