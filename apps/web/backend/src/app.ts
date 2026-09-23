import { Hono } from "hono";
import { respondWithApiError } from "./controllers/api-error-response.ts";
import { registerRandomPostalCodeRoute } from "./controllers/random-postal-code-controller.ts";
import {
  requestIdMiddleware,
  type RequestIdVariables,
} from "./controllers/request-id-middleware.ts";
import type { PostalCodeRepository } from "./repositories/postal-code-repository.ts";

export type CreateAppDependencies = {
  postalCodeRepository: PostalCodeRepository;
};

/**
 * Builds the Hono application.
 *
 * Dependencies are passed in rather than constructed here so a test can
 * supply a substitute repository without reaching into module state.
 * api-design.md section 5 fixes the direction: the controller maps HTTP to
 * the service, the service selects, and only the infrastructure layer knows
 * where the dataset comes from.
 *
 * CORS is added by Issue #11; a response without CORS headers is correct
 * until then (api-design.md section 6).
 */
export const createApp = (deps: CreateAppDependencies) => {
  const app = new Hono<{ Variables: RequestIdVariables }>();

  app.use("*", requestIdMiddleware);

  registerRandomPostalCodeRoute(app, deps);

  // Hono's own 404 and its default error page are plain text, not the
  // documented JSON envelope (api-design.md section 4.2), so both are
  // replaced here rather than left to answer the public boundary directly.
  app.notFound((c) =>
    respondWithApiError(
      c,
      404,
      "NOT_FOUND",
      "The requested route does not exist.",
    ),
  );
  app.onError((_err, c) =>
    respondWithApiError(
      c,
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
    ),
  );

  return app;
};
