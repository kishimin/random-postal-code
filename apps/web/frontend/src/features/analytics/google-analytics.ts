/**
 * The page the Google tag is installed into: its document, and the window
 * object that carries the data layer gtag.js reads. Passed in rather than read
 * from the globals, so a test can install into a page of its own.
 */
export type AnalyticsHost = {
  document: Document;
  window: object;
};

const TAG_LOADER_URL = "https://www.googletagmanager.com/gtag/js";

// gtag.js reads window.dataLayer unless its URL names another layer.
const DATA_LAYER_NAME = "dataLayer";

// design.md section 7: the EEA (the 27 EU member states plus Iceland,
// Liechtenstein, and Norway), the UK, and Switzerland, as ISO 3166 codes.
const CONSENT_REGIONS =
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(
    " ",
  );

const consentTo = (state: "denied" | "granted") => ({
  ad_storage: state,
  ad_user_data: state,
  ad_personalization: state,
  analytics_storage: state,
});

/**
 * Loads Google Analytics 4 for `measurementId` into `host` (Issue #92).
 *
 * Does nothing for an empty ID: only a production build carries one, and
 * every other build must load no Analytics script and make no request to
 * Google Analytics.
 *
 * The loader is appended as an async script and nothing waits for it, so a
 * tag that fails, is blocked, or never answers cannot hold up the page
 * (design.md section 7). Page views are not sent from here: the tag's
 * enhanced measurement counts the browser history changes the router makes.
 * @param {string} measurementId - A GA4 measurement ID, or "" for none.
 * @param {AnalyticsHost} host - The page to install the tag into.
 */
export const installGoogleAnalytics = (
  measurementId: string,
  host: AnalyticsHost,
): void => {
  if (measurementId === "") return;

  const existing: unknown = Reflect.get(host.window, DATA_LAYER_NAME);
  const dataLayer: unknown[] = Array.isArray(existing) ? existing : [];
  Reflect.set(host.window, DATA_LAYER_NAME, dataLayer);

  // Pushes the Arguments object itself: gtag.js reads that form as a command
  // and ignores a plain array, so a rest parameter would silently measure
  // nothing. An arrow function has no `arguments`, hence the function
  // expression the lint rules would otherwise forbid.
  // eslint-disable-next-line no-restricted-syntax -- see above
  const gtag: (...command: unknown[]) => void = function () {
    // eslint-disable-next-line prefer-rest-params -- see above
    dataLayer.push(arguments);
  };

  // Consent defaults come first: Google reads them "before any commands that
  // send measurement data (such as config or event)". The region-specific
  // default applies to those regions whatever the order, and the one without
  // a region to every other visitor.
  gtag("consent", "default", {
    ...consentTo("denied"),
    region: CONSENT_REGIONS,
  });
  gtag("consent", "default", consentTo("granted"));
  gtag("js", new Date());
  gtag("config", measurementId);

  const script = host.document.createElement("script");
  script.async = true;
  script.src = `${TAG_LOADER_URL}?id=${encodeURIComponent(measurementId)}`;
  host.document.head.appendChild(script);
};
