import type { ApiErrorCode } from "@zipnami/shared";
import type { Hono } from "hono";
import {
  cspViolationsIn,
  isCspReportMediaType,
} from "../services/csp-report.ts";
import { respondWithApiError } from "./api-error-response.ts";
import type { CorsBindings } from "./cors-middleware.ts";
import type { RequestIdVariables } from "./request-id-middleware.ts";
import {
  writeRequestLog,
  writeStructuredLog,
  type RequestLogStatus,
} from "./request-log.ts";

export const CSP_REPORT_PATH = "/api/csp-report";

// A browser report is a few hundred bytes; a batch of them still fits
// comfortably. Anything larger is not a report worth reading.
const MAX_REPORT_BYTES = 16 * 1024;

/*
 * Reads the body chunk by chunk and stops once it passes the limit, so an
 * oversized or endless body is refused without being held in memory.
 * Returns undefined when the limit is exceeded.
 */
const readWithin = async (
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<string | undefined> => {
  if (body === null) return "";
  const chunks: Uint8Array[] = [];
  const total = { length: 0 };

  for await (const chunk of body) {
    total.length += chunk.byteLength;
    if (total.length > limit) return undefined;
    chunks.push(chunk);
  }

  const joined = new Uint8Array(total.length);
  chunks.reduce((offset, chunk) => {
    joined.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return new TextDecoder().decode(joined);
};

/**
 * Registers POST /api/csp-report (api-design.md section 4.3): accepts the
 * browser's CSP violation reports, writes one bounded log entry per
 * violation, and answers 204 with nothing echoed back.
 */
export const registerCspReportRoute = (
  app: Hono<{ Bindings: CorsBindings; Variables: RequestIdVariables }>,
): void => {
  app.all(CSP_REPORT_PATH, async (c): Promise<Response> => {
    const startedAt = Date.now();
    const finish = (
      response: Response,
      status: RequestLogStatus,
      code: ApiErrorCode | "OK",
    ): Response => {
      writeRequestLog(c, {
        timestamp: new Date().toISOString(),
        requestId: c.get("requestId"),
        route: CSP_REPORT_PATH,
        method: c.req.method,
        status,
        durationMs: Date.now() - startedAt,
        code,
      });
      return response;
    };
    const refuse = (
      status: 400 | 405 | 413 | 415,
      code: ApiErrorCode,
      message: string,
      headers?: Record<string, string>,
    ) =>
      finish(
        respondWithApiError(c, status, code, message, headers),
        status,
        code,
      );

    if (c.req.method !== "POST") {
      return refuse(405, "METHOD_NOT_ALLOWED", "Use POST.", { allow: "POST" });
    }

    const contentType = c.req.header("content-type");
    if (!isCspReportMediaType(contentType)) {
      return refuse(415, "INVALID_REQUEST", "Send a CSP violation report.");
    }

    if (Number(c.req.header("content-length")) > MAX_REPORT_BYTES) {
      return refuse(413, "INVALID_REQUEST", "The report is too large.");
    }

    const body = await readWithin(c.req.raw.body, MAX_REPORT_BYTES);
    if (body === undefined) {
      return refuse(413, "INVALID_REQUEST", "The report is too large.");
    }

    const violations = cspViolationsIn(contentType, body);
    if (violations === undefined) {
      return refuse(400, "INVALID_REQUEST", "The body is not a CSP report.");
    }

    for (const violation of violations) {
      writeStructuredLog(c, {
        type: "csp-violation",
        timestamp: new Date().toISOString(),
        requestId: c.get("requestId"),
        ...violation,
      });
    }

    return finish(c.body(null, 204), 204, "OK");
  });
};
