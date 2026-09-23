import type { MiddlewareHandler } from "hono";

/**
 * Sets `X-Content-Type-Options: nosniff` on every response -- success and
 * error alike -- as api-design.md section 6 line 153 requires for all API
 * responses.
 *
 * Registered before routing, mirroring `requestIdMiddleware`, so the header
 * reaches `app.notFound()` and `app.onError()` responses too, not only the
 * ones a route handler answers directly.
 */
export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
};
