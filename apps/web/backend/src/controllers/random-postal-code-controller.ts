import type { ApiErrorCode } from "@zipnami/shared";
import type { Context, Hono } from "hono";
import type { PostalCodeRepository } from "../repositories/postal-code-repository.ts";
import { selectRandomPostalCode } from "../services/random-postal-code-service.ts";
import { respondWithApiError } from "./api-error-response.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";

const RANDOM_POSTAL_CODE_PATH = "/api/random";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type RandomPostalCodeControllerDependencies = {
  postalCodeRepository: PostalCodeRepository;
};

/**
 * One structured log line for a completed selection attempt (CR-003,
 * api-design.md section 7): timestamp, requestId, route, method, status,
 * duration, and a bounded code, the last of which is what lets a log reader
 * tell `DATA_UNAVAILABLE` apart from `INTERNAL_ERROR`. Deliberately excludes
 * the served postal code, any address, and the underlying error's raw
 * message or stack -- section 7 forbids complete response bodies and
 * secrets in logs, and `"ok"` carries a payload none of these fields need.
 */
type SelectionLogEntry = {
  readonly timestamp: string;
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly status: 200 | 500 | 503;
  readonly durationMs: number;
  readonly code: ApiErrorCode | "OK";
};

/**
 * Writes one structured log entry through `c.executionCtx.waitUntil`, so
 * logging does not delay the response that already went out.
 *
 * Accessing `c.executionCtx` throws outside a real Workers
 * `ExecutionContext` -- Hono's `.request()`/`.fetch()` test helpers do not
 * supply one, and several tests in this repository (this package's own
 * `app.medium.test.ts`, and the acceptance test's non-`respond()` paths)
 * call `createApp(...).fetch()` directly. Falling back to a synchronous
 * `console.log` there keeps every one of those callers answering correctly
 * instead of turning a successful response into a 500 because logging
 * itself failed.
 */
const logSelection = (
  c: Context<{ Variables: RequestIdVariables }>,
  entry: SelectionLogEntry,
): void => {
  const write = () => console.log(JSON.stringify(entry));

  try {
    c.executionCtx.waitUntil(Promise.resolve().then(write));
  } catch {
    write();
  }
};

/**
 * Registers `GET /api/random` on `app`, mapping HTTP concerns to
 * `RandomPostalCodeService` and back without holding any selection logic of
 * its own (api-design.md section 5: "The controller accepts the request,
 * invokes the service, and maps application results to HTTP only.").
 *
 * Bound with `app.all` rather than `app.get`, so a non-GET request still
 * reaches this handler and can be answered `405` instead of falling through
 * to `app.notFound()`'s `404` -- the two are different conditions
 * (api-design.md section 4.2) that only one registered route can tell apart.
 */
export const registerRandomPostalCodeRoute = (
  app: Hono<{ Variables: RequestIdVariables }>,
  deps: RandomPostalCodeControllerDependencies,
): void => {
  // Return type annotated explicitly (CR-006): with it, a future outcome
  // added to `PostalCodeSelectionResult` and left unhandled below makes the
  // switch fall through to an implicit `undefined`, which the compiler
  // rejects against `Promise<Response>` -- turning a runtime 500 (Hono
  // answering a handler that returned nothing) into a build failure instead.
  app.all(RANDOM_POSTAL_CODE_PATH, async (c): Promise<Response> => {
    // A server that supports GET must support HEAD (CR-004); Hono/the
    // Workers runtime drops the body of a HEAD response automatically, so
    // HEAD takes the exact same branch as GET rather than a copy of it.
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return respondWithApiError(
        c,
        405,
        "METHOD_NOT_ALLOWED",
        "Only GET is supported on this endpoint.",
        // RFC 9110 section 15.5.6 requires a 405 to name what is allowed
        // (CR-004); nothing did before this.
        { Allow: "GET, HEAD" },
      );
    }

    if (Object.keys(c.req.query()).length > 0) {
      return respondWithApiError(
        c,
        400,
        "INVALID_REQUEST",
        "This endpoint accepts no query parameters.",
      );
    }

    const startedAt = Date.now();
    const result = await selectRandomPostalCode(deps.postalCodeRepository);

    // Logs after the outcome and the HTTP status are both settled (CR-003),
    // so `code` always matches the status the client actually received.
    const respondAndLog = (
      status: 200 | 500 | 503,
      code: ApiErrorCode | "OK",
      response: Response,
    ): Response => {
      logSelection(c, {
        timestamp: new Date().toISOString(),
        requestId: c.get("requestId"),
        route: RANDOM_POSTAL_CODE_PATH,
        method: c.req.method,
        status,
        durationMs: Date.now() - startedAt,
        code,
      });

      return response;
    };

    switch (result.outcome) {
      case "ok":
        return respondAndLog(
          200,
          "OK",
          c.json(result.postalCode, 200, {
            "content-type": JSON_CONTENT_TYPE,
            "cache-control": "no-store",
          }),
        );
      case "dataUnavailable":
        return respondAndLog(
          503,
          "DATA_UNAVAILABLE",
          respondWithApiError(
            c,
            503,
            "DATA_UNAVAILABLE",
            "Postal code data is temporarily unavailable.",
          ),
        );
      case "internalError":
        return respondAndLog(
          500,
          "INTERNAL_ERROR",
          respondWithApiError(
            c,
            500,
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
          ),
        );
    }
  });
};
