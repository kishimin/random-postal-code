import type { Hono } from "hono";
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
  app.all(RANDOM_POSTAL_CODE_PATH, async (c) => {
    if (c.req.method !== "GET") {
      return respondWithApiError(
        c,
        405,
        "METHOD_NOT_ALLOWED",
        "Only GET is supported on this endpoint.",
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

    const result = await selectRandomPostalCode(deps.postalCodeRepository);

    switch (result.outcome) {
      case "ok":
        return c.json(result.postalCode, 200, {
          "content-type": JSON_CONTENT_TYPE,
          "cache-control": "no-store",
        });
      case "dataUnavailable":
        return respondWithApiError(
          c,
          503,
          "DATA_UNAVAILABLE",
          "Postal code data is temporarily unavailable.",
        );
      case "internalError":
        return respondWithApiError(
          c,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred.",
        );
    }
  });
};
