import type { ApiErrorCode } from "@zipnami/shared";
import type { Context, Hono } from "hono";
import type { PostalCodeRepository } from "../repositories/postal-code-repository.ts";
import { selectRandomPostalCode } from "../services/random-postal-code-service.ts";
import { respondWithApiError } from "./api-error-response.ts";
import type { CorsBindings } from "./cors-middleware.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";
import { writeRequestLog, type RequestLogStatus } from "./request-log.ts";

const RANDOM_POSTAL_CODE_PATH = "/api/random";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type RandomPostalCodeControllerDependencies = {
  postalCodeRepository: PostalCodeRepository;
};

/**
 * True when `c.req`'s headers describe a request body the client is sending
 * -- a non-zero `content-length`, or `transfer-encoding` for a body whose
 * length is not known up front. A `GET`/`HEAD` `Request` cannot be
 * constructed with a `body` init option (the Fetch spec, and this project's
 * workerd test runtime, both throw on the attempt), so these headers are
 * what a client actually sending a body on a `GET` looks like once the
 * request reaches this handler.
 */
const hasRequestBody = (
  c: Context<{ Bindings: CorsBindings; Variables: RequestIdVariables }>,
): boolean => {
  const contentLength = c.req.header("content-length");

  return (
    (contentLength !== undefined && contentLength !== "0") ||
    c.req.header("transfer-encoding") !== undefined
  );
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
  app: Hono<{ Bindings: CorsBindings; Variables: RequestIdVariables }>,
  deps: RandomPostalCodeControllerDependencies,
): void => {
  // Return type annotated explicitly (CR-006): with it, a future outcome
  // added to `PostalCodeSelectionResult` and left unhandled below makes the
  // switch fall through to an implicit `undefined`, which the compiler
  // rejects against `Promise<Response>` -- turning a runtime 500 (Hono
  // answering a handler that returned nothing) into a build failure instead.
  app.all(RANDOM_POSTAL_CODE_PATH, async (c): Promise<Response> => {
    // Captured before any rejection branch below, so every response this
    // handler produces -- accepted or rejected alike -- logs a duration
    // measured from the same point (CR-003, api-design.md section 7).
    const startedAt = Date.now();

    // Logs after the outcome and the HTTP status are both settled (CR-003),
    // so `code` always matches the status the client actually received.
    // Defined before the early-return branches below (a 405, 400, or the
    // eventual 200/503/500) so every one of them logs through this same
    // function instead of only the selection outcomes doing so.
    const respondAndLog = (
      status: RequestLogStatus,
      code: ApiErrorCode | "OK",
      response: Response,
    ): Response => {
      writeRequestLog(c, {
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

    // A server that supports GET must support HEAD (CR-004); Hono/the
    // Workers runtime drops the body of a HEAD response automatically, so
    // HEAD takes the exact same branch as GET rather than a copy of it.
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return respondAndLog(
        405,
        "METHOD_NOT_ALLOWED",
        respondWithApiError(
          c,
          405,
          "METHOD_NOT_ALLOWED",
          "Only GET is supported on this endpoint.",
          // RFC 9110 section 15.5.6 requires a 405 to name what is allowed
          // (CR-004); nothing did before this.
          { Allow: "GET, HEAD" },
        ),
      );
    }

    // docs/api-design.md section 4.2 rejects "Unsupported query parameter or
    // request body" alike with 400 INVALID_REQUEST; a GET carrying a body is
    // as much an unsupported request shape as an unknown query parameter.
    if (hasRequestBody(c)) {
      return respondAndLog(
        400,
        "INVALID_REQUEST",
        respondWithApiError(
          c,
          400,
          "INVALID_REQUEST",
          "This endpoint accepts no request body.",
        ),
      );
    }

    if (Object.keys(c.req.query()).length > 0) {
      return respondAndLog(
        400,
        "INVALID_REQUEST",
        respondWithApiError(
          c,
          400,
          "INVALID_REQUEST",
          "This endpoint accepts no query parameters.",
        ),
      );
    }

    const result = await selectRandomPostalCode(deps.postalCodeRepository);

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
