/**
 * One CSP violation as the Worker logs it, whichever shape the browser sent.
 */
export type CspViolation = {
  readonly documentURL: string;
  readonly effectiveDirective: string;
  readonly blockedURL: string;
  readonly disposition: string;
};

// report-uri sends one object as application/csp-report; report-to (the
// Reporting API) sends a JSON array as application/reports+json.
const CSP_REPORT = "application/csp-report";
const REPORTS_JSON = "application/reports+json";

// A field value longer than this is cut. The request body is already
// capped, but one oversized field should not dominate a log line.
const MAX_FIELD_LENGTH = 200;

const mediaTypeOf = (contentType: string | undefined): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

/** Whether a request's Content-Type is one a browser uses for CSP reports. */
export const isCspReportMediaType = (
  contentType: string | undefined,
): boolean => {
  const mediaType = mediaTypeOf(contentType);
  return mediaType === CSP_REPORT || mediaType === REPORTS_JSON;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";

/*
 * Only where the violation happened is kept. A query string or fragment can
 * carry anything a visitor had in the address bar, so it never reaches the
 * logs. Values that are not URLs ("inline", "eval") stay as they are.
 */
const withoutQueryOrFragment = (value: unknown): string => {
  const raw = text(value);
  if (!URL.canParse(raw)) return raw;
  const url = new URL(raw);
  return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD_LENGTH);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fromLegacy = (report: Record<string, unknown>): CspViolation => ({
  documentURL: withoutQueryOrFragment(report["document-uri"]),
  effectiveDirective: text(
    report["effective-directive"] ?? report["violated-directive"],
  ),
  blockedURL: withoutQueryOrFragment(report["blocked-uri"]),
  disposition: text(report.disposition),
});

const fromReportingApi = (body: Record<string, unknown>): CspViolation => ({
  documentURL: withoutQueryOrFragment(body.documentURL),
  effectiveDirective: text(body.effectiveDirective),
  blockedURL: withoutQueryOrFragment(body.blockedURL),
  disposition: text(body.disposition),
});

const parse = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * The CSP violations a report request carries, or undefined when the body
 * is not a report of the type its Content-Type claims.
 */
export const cspViolationsIn = (
  contentType: string | undefined,
  body: string,
): CspViolation[] | undefined => {
  const parsed = parse(body);

  if (mediaTypeOf(contentType) === CSP_REPORT) {
    const report = isRecord(parsed) ? parsed["csp-report"] : undefined;
    return isRecord(report) ? [fromLegacy(report)] : undefined;
  }

  if (!Array.isArray(parsed)) return undefined;

  return parsed
    .filter(
      (report): report is { type: string; body: Record<string, unknown> } =>
        isRecord(report) &&
        report.type === "csp-violation" &&
        isRecord(report.body),
    )
    .map((report) => fromReportingApi(report.body));
};
