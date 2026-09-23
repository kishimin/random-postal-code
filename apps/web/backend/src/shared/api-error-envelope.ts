import type { ApiErrorCode } from "@zipnami/shared";

/** The stable error envelope api-design.md section 4.2 defines. */
export type ApiErrorEnvelope = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
};

/**
 * Builds the error envelope, kept framework-agnostic so no layer below
 * `controllers/` needs to import Hono just to construct one.
 */
export const buildApiErrorEnvelope = (
  code: ApiErrorCode,
  message: string,
  requestId: string,
): ApiErrorEnvelope => ({ error: { code, message, requestId } });
