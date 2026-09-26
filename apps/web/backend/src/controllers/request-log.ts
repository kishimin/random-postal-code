import type { ApiErrorCode } from "@zipnami/shared";
import type { Context } from "hono";
import type { CorsBindings } from "./cors-middleware.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";

/**
 * The HTTP statuses a request-handling attempt on this API can end in. 204
 * is corsMiddleware's own preflight response (CR-003/TR-003), answered
 * before a request ever reaches a route handler.
 */
export type RequestLogStatus = 200 | 204 | 400 | 404 | 405 | 500 | 503;

/**
 * One structured log line for a completed request (CR-003, api-design.md
 * section 7): timestamp, requestId, route, method, status, duration, and a
 * bounded code, the last of which is what lets a log reader tell
 * `DATA_UNAVAILABLE` apart from `INTERNAL_ERROR`. Deliberately excludes the
 * served postal code, any address, and the underlying error's raw message or
 * stack -- section 7 forbids complete response bodies and secrets in logs,
 * and `"ok"` carries a payload none of these fields need.
 */
export type RequestLogEntry = {
  readonly timestamp: string;
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly status: RequestLogStatus;
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
 *
 * Shared by `random-postal-code-controller.ts` (the 200/503/500 selection
 * outcomes, and the 400/405 requests it rejects before reaching the
 * service), `app.ts` (the 404 `app.notFound()` fallback), and
 * `cors-middleware.ts` (the 204 it answers a preflight with, before the
 * request ever reaches a route handler), so every path a request can take
 * through this API writes the same log shape instead of each caller
 * re-implementing the waitUntil/console.log fallback.
 */
export const writeRequestLog = (
  c: Context<{ Bindings: CorsBindings; Variables: RequestIdVariables }>,
  entry: RequestLogEntry,
): void => {
  const write = () => console.log(JSON.stringify(entry));

  try {
    c.executionCtx.waitUntil(Promise.resolve().then(write));
  } catch {
    write();
  }
};
