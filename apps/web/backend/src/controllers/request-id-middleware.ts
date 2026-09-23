import type { MiddlewareHandler } from "hono";
import { generateRequestId } from "../shared/generate-request-id.ts";

/** Hono context variables this middleware makes available downstream. */
export type RequestIdVariables = {
  requestId: string;
};

/**
 * Stamps every response -- success and error alike -- with a fresh request
 * id (api-design.md section 4.2), so a report naming one of `X-Request-Id`
 * or the error envelope's `requestId` can always be correlated with the
 * other.
 *
 * Registered before routing, so a request id exists even for a 404 answered
 * by `app.notFound()` or an error resolved by `app.onError()`: both are
 * reached through this middleware's `next()` call, not around it. The
 * header is set after `next()` because Hono still allows mutating headers on
 * a response the downstream handler already finalized.
 */
export const requestIdMiddleware: MiddlewareHandler<{
  Variables: RequestIdVariables;
}> = async (c, next) => {
  const requestId = generateRequestId();

  c.set("requestId", requestId);
  await next();
  c.header("x-request-id", requestId);
};
