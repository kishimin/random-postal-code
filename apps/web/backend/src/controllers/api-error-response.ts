import type { ApiErrorCode } from "@zipnami/shared";
import type { Context } from "hono";
import { buildApiErrorEnvelope } from "../shared/api-error-envelope.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** The HTTP statuses api-design.md section 4.2 maps an `ApiErrorCode` to. */
type ApiErrorStatus = 400 | 404 | 405 | 500 | 503;

/**
 * Answers one request with the stable JSON error envelope, carrying the same
 * request id this request's `requestIdMiddleware` already generated so the
 * header and the body never disagree.
 */
export const respondWithApiError = (
  c: Context<{ Variables: RequestIdVariables }>,
  status: ApiErrorStatus,
  code: ApiErrorCode,
  message: string,
): Response =>
  c.json(buildApiErrorEnvelope(code, message, c.get("requestId")), status, {
    "content-type": JSON_CONTENT_TYPE,
  });
