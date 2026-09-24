import { Hono } from "hono";
import { respondWithApiError } from "./controllers/api-error-response.ts";
import { corsMiddleware, type CorsBindings } from "./controllers/cors-middleware.ts";
import { registerRandomPostalCodeRoute } from "./controllers/random-postal-code-controller.ts";
import {
  requestIdMiddleware,
  type RequestIdVariables,
} from "./controllers/request-id-middleware.ts";
import { writeRequestLog } from "./controllers/request-log.ts";
import { securityHeadersMiddleware } from "./controllers/security-headers-middleware.ts";
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
 * CORS is enforced by corsMiddleware (Issue #11, api-design.md section 6).
 */
export const createApp = (deps: CreateAppDependencies) => {
  const app = new Hono<{
    Bindings: CorsBindings;
    Variables: RequestIdVariables;
  }>();

  app.use("*", requestIdMiddleware);
  app.use("*", securityHeadersMiddleware);
  app.use("*", corsMiddleware);

  registerRandomPostalCodeRoute(app, deps);

  // Hono's own 404 and its default error page are plain text, not the
  // documented JSON envelope (api-design.md section 4.2), so both are
  // replaced here rather than left to answer the public boundary directly.
  //
  // Logged the same way registerRandomPostalCodeRoute logs its own 405/400
  // rejections and 200/503/500 outcomes (api-design.md section 7): an
  // unmatched route reaching this handler is a request that was rejected,
  // not one that never happened, and it never reaches the controller to be
  // logged there. `route` names the path actually requested -- there is no
  // registered route to attribute it to -- so an operator can see which
  // unknown paths are being hit.
  app.notFound((c) => {
    const startedAt = Date.now();
    const response = respondWithApiError(
      c,
      404,
      "NOT_FOUND",
      "The requested route does not exist.",
    );

    writeRequestLog(c, {
      timestamp: new Date().toISOString(),
      requestId: c.get("requestId"),
      route: c.req.path,
      method: c.req.method,
      status: 404,
      durationMs: Date.now() - startedAt,
      code: "NOT_FOUND",
    });

    return response;
  });
  // PR #35 review found that an exception escaping a handler or middleware
  // before it returns a promise -- for example a repository throwing
  // synchronously -- reaches this fallback without ever going through
  // registerRandomPostalCodeRoute's own respondAndLog, so a genuinely
  // unexpected failure had no structured entry or request-id correlation
  // even though the classified `INTERNAL_ERROR` results are logged. Logged
  // the same way app.notFound() above is: a request that ends here was
  // still rejected, not one that never happened.
  app.onError((_err, c) => {
    const startedAt = Date.now();
    const response = respondWithApiError(
      c,
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
    );

    writeRequestLog(c, {
      timestamp: new Date().toISOString(),
      requestId: c.get("requestId"),
      route: c.req.path,
      method: c.req.method,
      status: 500,
      durationMs: Date.now() - startedAt,
      code: "INTERNAL_ERROR",
    });

    return response;
  });

  return app;
};
