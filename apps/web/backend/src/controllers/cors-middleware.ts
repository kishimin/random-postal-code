import type { MiddlewareHandler } from "hono";

/**
 * The Workers environment binding this middleware reads. A single
 * comma-separated string rather than a JSON array or one variable per
 * environment: it must be settable identically as a wrangler.jsonc `vars`
 * entry, a `.dev.vars` line, or a `wrangler secret`, and only a plain string
 * has one shape across all three (Issue #11, acceptance/cors-and-secret-
 * boundaries.medium.test.ts).
 */
export type CorsBindings = {
  ALLOWED_ORIGINS?: string;
};

/**
 * Parses the configured allowlist, rejecting a literal `*` even if present:
 * api-design.md section 6 forbids ever authorizing every origin, and a
 * wildcard pasted into the deployment configuration is the realistic way
 * that would happen.
 */
const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? "").split(",").filter((origin) => origin !== "" && origin !== "*");

/**
 * Enforces the Web API's CORS allowlist (Issue #11, api-design.md section
 * 6): only an origin present verbatim in the deployment's `ALLOWED_ORIGINS`
 * is echoed back in `Access-Control-Allow-Origin`. Every other request --
 * including one with no `Origin` header at all -- is answered without a
 * CORS authorization header, never with `*`.
 */
export const corsMiddleware: MiddlewareHandler<{
  Bindings: CorsBindings;
}> = async (c, next) => {
  const origin = c.req.header("origin");
  // c.env is undefined -- not {} -- when a caller (a test's app.request(),
  // Hono's own defaults) supplies no environment at all, so this cannot
  // assume c.env is present the way a real Workers request guarantees.
  const allowedOrigins = parseAllowedOrigins(c.env?.ALLOWED_ORIGINS);

  await next();

  if (origin !== undefined && allowedOrigins.includes(origin)) {
    c.header("access-control-allow-origin", origin);
  }
};
