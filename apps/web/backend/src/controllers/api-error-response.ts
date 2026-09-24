import type { ApiErrorCode } from "@zipnami/shared";
import type { Context } from "hono";
import { buildApiErrorEnvelope } from "../shared/api-error-envelope.ts";
import type { CorsBindings } from "./cors-middleware.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** The HTTP statuses api-design.md section 4.2 maps an `ApiErrorCode` to. */
type ApiErrorStatus = 400 | 404 | 405 | 500 | 503;

/**
 * Answers one request with the stable JSON error envelope, carrying the same
 * request id this request's `requestIdMiddleware` already generated so the
 * header and the body never disagree.
 *
 * `extraHeaders` is optional and additive to `content-type`: CR-004 (RFC
 * 9110 section 15.5.6) needs an `Allow` header on a 405 response, and no
 * other error response needs one, so this stays a caller-supplied extension
 * rather than a new fixed parameter every call site must pass `undefined`
 * for.
 */
export const respondWithApiError = (
  c: Context<{ Bindings: CorsBindings; Variables: RequestIdVariables }>,
  status: ApiErrorStatus,
  code: ApiErrorCode,
  message: string,
  extraHeaders?: Record<string, string>,
): Response =>
  c.json(buildApiErrorEnvelope(code, message, c.get("requestId")), status, {
    "content-type": JSON_CONTENT_TYPE,
    ...extraHeaders,
  });
