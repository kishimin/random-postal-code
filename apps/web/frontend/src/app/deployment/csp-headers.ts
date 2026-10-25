/**
 * The placeholder public/_headers uses where the policy's reporting
 * endpoint goes (Issue #72). The endpoint is the Worker's, and its URL is
 * known only per build (VITE_API_BASE_URL), so a static file cannot name it.
 * The build fills it in.
 */
export const CSP_REPORT_ENDPOINT_TOKEN = "__CSP_REPORT_ENDPOINT__";

// A URL that is safe to place inside a header value, inside a quoted
// Reporting-Endpoints entry, and as a CSP source: no whitespace, quotes,
// semicolons, or commas that would end the value or start another directive.
const SAFE_ENDPOINT = /^https?:\/\/[^\s"';,]+$/;

/**
 * Returns the Pages `_headers` text with every placeholder replaced by the
 * reporting endpoint. Throws when there is no placeholder, so a policy cannot
 * silently lose its endpoint, or when the endpoint could break out of the
 * header it is written into.
 */
export const fillCspReportEndpoint = (
  headers: string,
  endpoint: string,
): string => {
  if (!headers.includes(CSP_REPORT_ENDPOINT_TOKEN)) {
    throw new Error(
      `public/_headers has no ${CSP_REPORT_ENDPOINT_TOKEN} placeholder for the CSP report endpoint`,
    );
  }
  if (!SAFE_ENDPOINT.test(endpoint)) {
    throw new Error(
      "the CSP report endpoint is not a plain http(s) URL and cannot be written into a header",
    );
  }

  return headers.replaceAll(CSP_REPORT_ENDPOINT_TOKEN, endpoint);
};
