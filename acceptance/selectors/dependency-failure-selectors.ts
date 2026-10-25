/*
 * What the Issue #17 acceptance test recognises dependencies by.
 *
 * Each value here is a network-boundary contract, not Zipnami's markup: a host
 * the page must never reach for real, or a body the API must never be trusted
 * to send. Holding them here rather than in the Page Object keeps one edit per
 * contract change (ADR-0054).
 */

// The only hosts a test run may reach for real: the preview server that serves
// the build, and the API origin VITE_API_BASE_URL baked into it. Both are local.
const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether a request would leave the machine for a third-party service.
 *
 * Decided by hostname rather than by a list of third parties, so a dependency
 * this file has never heard of — a Maps embed, a consent message, a font — is
 * caught the moment it appears instead of reaching the live service.
 * @param url - The request URL.
 */
export const isThirdPartyRequest = (url: URL) =>
  (url.protocol === "http:" || url.protocol === "https:") &&
  !localHostnames.has(url.hostname);

/*
 * A success status carrying a body that is JSON but not a postal code.
 *
 * api-design.md section 4.1 fixes the success shape; this violates it on
 * purpose (a seven-digit code that is not seven digits, no addresses). It is
 * what an intermediary rewriting the response, or an incompatible deployment,
 * would hand the client.
 */
export const schemaViolatingBody = JSON.stringify({
  postalCode: "not-a-postal-code",
  addresses: [],
});

/*
 * A success status carrying a body that is not JSON at all.
 *
 * What a captive portal or a misrouted static host answers with: a page, not an
 * API response.
 */
export const nonJsonBody =
  "<!doctype html><html><body>Not the Zipnami API</body></html>";

/*
 * Stands in for an advertising SDK that fails while it runs.
 *
 * It arrives successfully — so a script `error` event never fires — and then
 * breaks both ways an SDK can: its queue refuses every slot, and its own
 * top-level code throws. Nothing here contacts Google.
 */
export const throwingAdvertisingSdk = `
(() => {
  window.adsbygoogle = {
    loaded: true,
    push: () => {
      throw new Error("Advertising SDK substitute: push failed");
    },
  };
  throw new Error("Advertising SDK substitute: initialisation failed");
})();
`;
