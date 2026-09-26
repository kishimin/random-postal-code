import type { MiddlewareHandler } from "hono";
import type { RequestIdVariables } from "./request-id-middleware.ts";
import { writeRequestLog } from "./request-log.ts";

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
 *
 * Each entry is trimmed before comparison (CR-002/TR-004): a
 * comma-followed-by-space list is the natural way a human writes this value,
 * but the browser's real `Origin` header never carries leading whitespace,
 * so an untrimmed entry could never match and would be silently denied.
 *
 * `"null"` is filtered the same way `*` is (Codex review on this PR): a
 * browser serializes many unrelated opaque contexts -- a sandboxed iframe, a
 * `data:` document, a redirected request -- to the literal `Origin: null`,
 * so authorizing that string authorizes all of them at once, the same
 * boundary failure a wildcard is rejected for.
 */
const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "" && origin !== "*" && origin !== "null");

/**
 * The only methods GET /api/random needs (api-design.md section 6: "Permit
 * GET and the minimum headers needed by the browser client"). Fixed rather
 * than derived from the request, so asking for a write method during
 * preflight can never get it granted.
 */
const ALLOWED_METHODS = "GET, HEAD";

/**
 * Enforces the Web API's CORS allowlist (Issue #11, api-design.md section
 * 6): only an origin present verbatim in the deployment's `ALLOWED_ORIGINS`
 * is echoed back in `Access-Control-Allow-Origin`. Every other request --
 * including one with no `Origin` header at all -- is answered without a
 * CORS authorization header, never with `*`.
 *
 * Handles a CORS preflight itself rather than letting it reach the route
 * (which has none registered for OPTIONS): a preflight that fell through to
 * the app's own 404/405 handling would answer with an error status, and an
 * erroring preflight blocks the very GET the browser was asking about.
 *
 * A plain `OPTIONS` request that is not a CORS preflight -- no
 * `Access-Control-Request-Method` header, which only a browser's own
 * preflight step ever sends -- is not short-circuited (Codex review on this
 * PR): it falls through to the route like any other method, so it still
 * receives the documented `405 METHOD_NOT_ALLOWED` rather than an
 * unconditional 204 that would misreport it as an authorized preflight.
 */
export const corsMiddleware: MiddlewareHandler<{
  Bindings: CorsBindings;
  Variables: RequestIdVariables;
}> = async (c, next) => {
  const origin = c.req.header("origin");
  // c.env is undefined -- not {} -- when a caller (a test's app.request(),
  // Hono's own defaults) supplies no environment at all, so this cannot
  // assume c.env is present the way a real Workers request guarantees.
  const allowedOrigins = parseAllowedOrigins(c.env?.ALLOWED_ORIGINS);
  const isAuthorized = origin !== undefined && allowedOrigins.includes(origin);

  // Every response this middleware answers was decided by the request's
  // Origin header, whether or not that header was present -- api-design.md
  // section 6 requires Vary: Origin on all of them so a cache sitting in
  // front of the Worker never serves one origin's response to another.
  // Set once here, unconditionally: it depends only on the request, not on
  // which branch below answers it (CR-005).
  c.header("vary", "Origin", { append: true });

  const markAuthorization = (): void => {
    if (isAuthorized) {
      c.header("access-control-allow-origin", origin);
    }
  };

  const isPreflight =
    c.req.method === "OPTIONS" &&
    c.req.header("access-control-request-method") !== undefined;

  if (isPreflight) {
    const startedAt = Date.now();

    // api-design.md section 6 also forbids trusting client-supplied
    // forwarding headers; this handler never reads Access-Control-Request-
    // Headers, so nothing a caller asks for is ever opened or reflected.
    markAuthorization();
    if (isAuthorized) {
      c.header("access-control-allow-methods", ALLOWED_METHODS);
    }

    const response = c.body(null, 204);

    // CR-003/TR-003: request-log.ts's own doc comment asserts every request
    // this API handles produces a structured log entry, and app.ts's
    // app.notFound()/app.onError() already follow that invariant (PR #35).
    // A preflight answered here never reaches a route handler, so without
    // this call a misconfigured allowlist's first symptom in production --
    // a denied preflight -- left zero server-side log evidence. `code` uses
    // "OK" -- the same value random-postal-code-controller.ts logs for a
    // successful 200 -- because a preflight this middleware answers is not
    // an error outcome, allowed or not.
    writeRequestLog(c, {
      timestamp: new Date().toISOString(),
      requestId: c.get("requestId"),
      route: c.req.path,
      method: c.req.method,
      status: 204,
      durationMs: Date.now() - startedAt,
      code: "OK",
    });

    return response;
  }

  await next();
  markAuthorization();
};
