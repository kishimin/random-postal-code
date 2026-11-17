import { describe, expect, test, vi } from "vitest";
import {
  failureOf,
  fetchRandomPostalCode,
  GenerationError,
  randomPostalCodeUrl,
  type GenerationFailure,
} from "./random-postal-code";

const origin = "https://api.example.test";

const tokyo = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const respond = (status: number, body: unknown): Response =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
  });

const envelope = (code: string) => ({
  error: { code, message: "safe message", requestId: "req-1" },
});

// The origin is required, not defaulted: passing undefined to a defaulted
// parameter would silently test the configured origin instead.
const failureFrom = async (
  request: typeof fetch,
  apiBaseUrl: string | undefined,
): Promise<GenerationFailure | undefined> => {
  try {
    await fetchRandomPostalCode(apiBaseUrl, request);
    return undefined;
  } catch (error) {
    return failureOf(error);
  }
};

describe("randomPostalCodeUrl", () => {
  test.each([
    [origin, `${origin}/api/random`],
    [`${origin}/`, `${origin}/api/random`],
    [`${origin}/zipnami`, `${origin}/zipnami/api/random`],
    [`${origin}/zipnami//`, `${origin}/zipnami/api/random`],
  ])("puts api/random under %j", (base, expected) => {
    expect(randomPostalCodeUrl(base)).toBe(expected);
  });

  test.each([
    undefined,
    "",
    "http://api.example.test",
    "api.example.test",
    "https://",
    "https://api.example.test?x=1",
    "https://api.example.test#top",
    "https://api example.test",
  ])("gives no URL for %j, which is not an HTTPS origin", (base) => {
    expect(randomPostalCodeUrl(base)).toBeUndefined();
  });
});

describe("fetchRandomPostalCode", () => {
  test("asks the API for JSON and returns the result", async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(respond(200, tokyo)),
    );

    await expect(fetchRandomPostalCode(origin, request)).resolves.toEqual(
      tokyo,
    );
    expect(request).toHaveBeenCalledWith(`${origin}/api/random`, {
      headers: { Accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  test("sets no cache mode, which React Native's fetch would turn into a query the API rejects", async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(respond(200, tokyo)),
    );

    await fetchRandomPostalCode(origin, request);

    const [, init] = request.mock.calls[0] ?? [];
    expect(init).not.toHaveProperty("cache");
  });

  test("reports a request that outlasts the time limit as offline", async () => {
    // Settles only when its signal aborts, like a connection that stalls.
    const stalled = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchRandomPostalCode(origin, stalled, { timeoutMs: 10 }).catch(
        failureOf,
      ),
    ).resolves.toBe("offline");
  });

  test.each([undefined, "http://api.example.test"])(
    "does not call the API when the origin is %j",
    async (base) => {
      const request = vi.fn<typeof fetch>();

      await expect(failureFrom(request, base)).resolves.toBe("unexpected");
      expect(request).not.toHaveBeenCalled();
    },
  );

  test.each<[string, () => Promise<Response>, GenerationFailure]>([
    [
      "no response arrived",
      () => Promise.reject(new TypeError("Network request failed")),
      "offline",
    ],
    [
      "the dataset is unavailable",
      () => Promise.resolve(respond(503, envelope("DATA_UNAVAILABLE"))),
      "service-unavailable",
    ],
    [
      "the API failed internally",
      () => Promise.resolve(respond(500, envelope("INTERNAL_ERROR"))),
      "unexpected",
    ],
    [
      "an error carries no envelope",
      () => Promise.resolve(respond(502, { message: "Bad Gateway" })),
      "invalid-response",
    ],
    [
      "the body is not JSON",
      () => Promise.resolve(respond(200, "<html></html>")),
      "invalid-response",
    ],
    [
      "the postal code breaks the contract",
      () =>
        Promise.resolve(
          respond(200, { postalCode: "100-0001", addresses: [] }),
        ),
      "invalid-response",
    ],
  ])("reports %s as %j", async (_, answer, expected) => {
    await expect(
      failureFrom(vi.fn<typeof fetch>(answer), origin),
    ).resolves.toBe(expected);
  });
});

describe("failureOf", () => {
  test("reads the failure a GenerationError carries", () => {
    expect(failureOf(new GenerationError("offline"))).toBe("offline");
  });

  test("treats any other rejection as unexpected", () => {
    expect(failureOf(new Error("boom"))).toBe("unexpected");
  });
});
