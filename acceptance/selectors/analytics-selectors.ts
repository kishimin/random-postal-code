/*
 * What the Issue #92 acceptance tests recognise Google Analytics by.
 *
 * Every value here is Google contract or the Issue owner decision, not
 * Zipnami markup: the host and path the Google tag (gtag.js) is served from,
 * the hosts GA4 sends measurement to, the consent types and region list of
 * Google consent mode, and a stand-in for the tag that contacts no Google
 * service. Holding them here keeps one edit per contract change (ADR-0054).
 */

/*
 * The Google tag loader for a GA4 measurement ID.
 *
 * gtag.js is served from www.googletagmanager.com/gtag/js?id=<measurement ID>
 * (Google tag platform documentation). The same host also serves other Google
 * tags, which is why the advertising selectors already treat it as
 * advertising traffic; this pattern narrows it to the gtag loader.
 */
export const analyticsTagPattern =
  /^https:\/\/www\.googletagmanager\.com\/gtag\/js(?:\?|$)/i;

/*
 * Every request that is Google Analytics traffic: the tag loader above, and
 * the GA4 collection hosts (*.google-analytics.com, *.analytics.google.com).
 */
export const analyticsRequestPattern =
  /^https?:\/\/(?:(?:[a-z0-9-]+\.)*(?:google-analytics\.com|analytics\.google\.com)\/|www\.googletagmanager\.com\/gtag\/)/i;

/*
 * A well-formed GA4 measurement ID that belongs to no property.
 *
 * GA4 measurement IDs are "G-" followed by uppercase letters and digits. This
 * one is only ever baked into a build these tests serve themselves, and every
 * request it would cause is answered or refused at the network boundary.
 */
export const testMeasurementId = "G-ATDD000092";

/*
 * Values a production deploy must refuse as a measurement ID: missing, empty,
 * a Universal Analytics property ID, a Google Ads ID, a bare prefix, and text
 * that is not an ID at all. The Issue asks for the G- format.
 */
export const unusableMeasurementIds = [
  undefined,
  "",
  "   ",
  "UA-123456789-1",
  "AW-1234567890",
  "G-",
  "not-a-measurement-id",
] as const;

/*
 * The four consent types Google consent mode defines (Google tag platform
 * documentation, "Set up consent mode on websites"). Visits are measured by
 * analytics_storage; the three advertising types are the ones the same page
 * and the AdSense tag read, so a default for the region covers all four.
 */
export const consentTypes = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
] as const;

/*
 * The regions whose default is "denied": the European Economic Area (the 27
 * EU member states plus Iceland, Liechtenstein, and Norway), the United
 * Kingdom, and Switzerland, as ISO 3166-1 alpha-2 codes. Google consent mode
 * takes ISO 3166-2 region codes, of which a country code is the top level.
 */
export const consentRegions = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
] as const;

/*
 * Stands in for gtag.js.
 *
 * It only records that it ran. The real tag reads the commands the page queued
 * on its data layer, which the tests read for themselves, so a substitute that
 * did more would only be testing itself. It contacts no Google service.
 */
export const analyticsTagSubstitute =
  "(() => { window.__zipnamiAnalyticsTagRuns = (window.__zipnamiAnalyticsTagRuns || 0) + 1; })();";
