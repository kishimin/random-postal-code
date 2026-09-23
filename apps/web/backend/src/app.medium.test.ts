import { apiErrorResponseSchema, type PostalCode } from "@zipnami/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
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
    postalCodeRepository: {
      listPostalCodes: () => Promise.resolve(postalCodes),
    },
  });

/** Parses a response body as the shared error envelope, not as `unknown`. */
const errorBodyOf = async (response: Response) =>
  apiErrorResponseSchema.parse(await response.json());

describe("createApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  // A GET/HEAD `Request` cannot be constructed with a `body` init option --
  // the Fetch spec (and this project's workerd test runtime) throws
  // "Request with a GET or HEAD method cannot have a body." on the attempt.
  // A real non-empty body is still signaled to the server through
  // `content-length` or `transfer-encoding`, which a `Request` can carry
  // without a `body` option, so that is what a misbehaving client's GET
  // with a body looks like once it reaches this handler.
  test("answers GET /api/random carrying a non-empty content-length with 400 INVALID_REQUEST", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", {
      method: "GET",
      headers: { "content-length": "13" },
    });
    const body = await errorBodyOf(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  test("answers GET /api/random carrying a chunked transfer-encoding with 400 INVALID_REQUEST", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", {
      method: "GET",
      headers: { "transfer-encoding": "chunked" },
    });
    const body = await errorBodyOf(response);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  test("answers GET /api/random with content-length: 0 as a normal bodyless request", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", {
      method: "GET",
      headers: { "content-length": "0" },
    });

    expect(response.status).toBe(200);
  });

  test("answers POST /api/random with 405 METHOD_NOT_ALLOWED", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", { method: "POST" });
    const body = await errorBodyOf(response);

    expect(response.status).toBe(405);
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  // RFC 9110 section 15.5.6 requires an `Allow` header on a 405, and a
  // server that supports GET must support HEAD.
  test("adds an Allow header naming GET and HEAD to a 405 response", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  test("answers HEAD /api/random the same way as GET, rather than 405", async () => {
    const app = appServing([onlyPostalCode]);

    const response = await app.request("/api/random", { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
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
        listPostalCodes: () => Promise.reject(new Error(secret)),
      },
    });

    const response = await app.request("/api/random");
    const text = await response.clone().text();
    const body = await errorBodyOf(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain(secret);
  });

  // api-design.md section 6 line 153 requires `X-Content-Type-Options:
  // nosniff` on every API response. It was unset on every path -- success
  // and error alike.
  describe("X-Content-Type-Options header", () => {
    test("sets nosniff on a successful GET /api/random", async () => {
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/random");

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    test("sets nosniff on 400 INVALID_REQUEST", async () => {
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/random?postalCode=1000001");

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    test("sets nosniff on 404 NOT_FOUND", async () => {
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/unknown");

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    test("sets nosniff on 405 METHOD_NOT_ALLOWED", async () => {
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/random", { method: "POST" });

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    test("sets nosniff on 503 DATA_UNAVAILABLE", async () => {
      const app = appServing([]);

      const response = await app.request("/api/random");

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    test("sets nosniff on 500 INTERNAL_ERROR", async () => {
      const app = createApp({
        postalCodeRepository: {
          listPostalCodes: () => Promise.reject(new Error("boom")),
        },
      });

      const response = await app.request("/api/random");

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });

  // api-design.md section 7 requires a structured log per request --
  // timestamp, requestId, route, method, status, duration, and a bounded
  // error code -- that distinguishes dataset unavailability from an
  // unexpected failure, and that never carries a response body, an address,
  // or a raw error message. Nothing logged anything before this.
  describe("structured request logging", () => {
    const parseLoggedEntry = (
      call: unknown[] | undefined,
    ): Record<string, unknown> => {
      const [line] = call ?? [];
      return JSON.parse(line as string) as Record<string, unknown>;
    };

    test("logs one structured entry for a successful request, without the postal code or address payload", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/random");
      const body = await response.json();

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);
      const loggedLine = logSpy.mock.calls[0]?.[0] as string;

      expect(entry).toMatchObject({
        route: "/api/random",
        method: "GET",
        status: 200,
        code: "OK",
      });
      expect(typeof entry.requestId).toBe("string");
      expect(entry.requestId).not.toBe("");
      expect(Number.isNaN(Date.parse(entry.timestamp as string))).toBe(false);
      expect(typeof entry.durationMs).toBe("number");
      // Nothing about the served payload -- postal code or address -- leaks
      // into the log line.
      expect(loggedLine).not.toContain(onlyPostalCode.postalCode);
      expect(loggedLine).not.toContain("addresses");
      expect(loggedLine).not.toContain(JSON.stringify(body));
    });

    test("logs DATA_UNAVAILABLE with 503, distinct from an unexpected failure", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([]);

      await app.request("/api/random");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({ status: 503, code: "DATA_UNAVAILABLE" });
    });

    test("logs INTERNAL_ERROR with 500, without leaking the underlying failure's message", async () => {
      const secret = "some-internal-detail-that-must-not-leak";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = createApp({
        postalCodeRepository: {
          listPostalCodes: () => Promise.reject(new Error(secret)),
        },
      });

      await app.request("/api/random");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const loggedLine = logSpy.mock.calls[0]?.[0] as string;
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
      expect(loggedLine).not.toContain(secret);
    });

    // PR #35 review found that an exception escaping a handler or middleware
    // before it returns a promise -- e.g. a repository throwing
    // synchronously -- reaches app.onError() without ever going through
    // registerRandomPostalCodeRoute's own respondAndLog, so nothing logs it.
    // A synchronous throw (not a rejected promise) is what reproduces this:
    // selectRandomPostalCode's `repository.listPostalCodes().catch(...)`
    // never gets to attach its `.catch` handler when the call itself throws,
    // so the failure propagates past the service's own classification and
    // out through the route handler to app.onError().
    test("logs a structured entry for an exception that escapes to app.onError, without leaking the underlying failure's message", async () => {
      const secret = "some-internal-detail-that-must-not-leak";
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = createApp({
        postalCodeRepository: {
          listPostalCodes: () => {
            throw new Error(secret);
          },
        },
      });

      const response = await app.request("/api/random");
      const text = await response.clone().text();

      expect(response.status).toBe(500);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const loggedLine = logSpy.mock.calls[0]?.[0] as string;
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({
        route: "/api/random",
        method: "GET",
        status: 500,
        code: "INTERNAL_ERROR",
      });
      expect(typeof entry.requestId).toBe("string");
      expect(entry.requestId).not.toBe("");
      expect(Number.isNaN(Date.parse(entry.timestamp as string))).toBe(false);
      expect(typeof entry.durationMs).toBe("number");
      expect(text).not.toContain(secret);
      expect(loggedLine).not.toContain(secret);
    });

    test("registers the log write with waitUntil when a real ExecutionContext is available, rather than writing it directly", async () => {
      const waitUntilPromises: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: (promise: Promise<unknown>) => {
          waitUntilPromises.push(promise);
        },
        passThroughOnException: () => {},
      } as unknown as ExecutionContext;
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      const response = await app.request(
        "/api/random",
        undefined,
        undefined,
        executionCtx,
      );

      expect(response.status).toBe(200);
      // The write is handed to the execution context rather than only ever
      // called inline: with a real ExecutionContext available, the runtime
      // -- not this handler -- decides when it is safe to let the isolate
      // go idle once that promise settles.
      expect(waitUntilPromises).toHaveLength(1);

      await waitUntilPromises[0];

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    // Hono's `.request()`/`.fetch()` test helpers (used throughout this file
    // and by other tests in this repository that call `createApp(...).fetch()`
    // directly) do not supply an ExecutionContext, and `c.executionCtx` throws
    // when accessed without one. Logging must not turn that into a failed
    // response.
    test("still answers successfully when no ExecutionContext is available to defer the log to", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      const response = await app.request("/api/random");

      expect(response.status).toBe(200);
    });

    // A rejected or unmatched request is still a request api-design.md
    // section 7 asks every one of to be logged -- these three used to fall
    // through the early `return`s before `respondAndLog` existed, or (for
    // 404) never reached the controller at all, so nothing logged them.
    test("logs a structured entry for 405 METHOD_NOT_ALLOWED", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      await app.request("/api/random", { method: "POST" });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({
        route: "/api/random",
        method: "POST",
        status: 405,
        code: "METHOD_NOT_ALLOWED",
      });
    });

    test("logs a structured entry for 400 INVALID_REQUEST on an unsupported query parameter", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      await app.request("/api/random?postalCode=1000001");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({
        route: "/api/random",
        method: "GET",
        status: 400,
        code: "INVALID_REQUEST",
      });
    });

    test("logs a structured entry for 400 INVALID_REQUEST on a GET carrying a non-empty body", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      await app.request("/api/random", {
        method: "GET",
        headers: { "content-length": "13" },
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({
        route: "/api/random",
        method: "GET",
        status: 400,
        code: "INVALID_REQUEST",
      });
    });

    test("logs a structured entry for 404 NOT_FOUND on an unmatched route", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const app = appServing([onlyPostalCode]);

      await app.request("/api/unknown");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const entry = parseLoggedEntry(logSpy.mock.calls[0]);

      expect(entry).toMatchObject({
        route: "/api/unknown",
        method: "GET",
        status: 404,
        code: "NOT_FOUND",
      });
    });
  });
});
