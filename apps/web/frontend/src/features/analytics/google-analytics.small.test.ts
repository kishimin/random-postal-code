import { describe, expect, test } from "vitest";
import { installGoogleAnalytics, type AnalyticsHost } from "./google-analytics";

const MEASUREMENT_ID = "G-ABC123DEF4";

// design.md section 7: denied for the EEA (27 EU member states plus Iceland,
// Liechtenstein, and Norway), the UK, and Switzerland.
const CONSENT_REGIONS = [
  ...["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE"],
  ...["GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT"],
  ...["RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"],
];

const CONSENT_TYPES = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
];

/**
 * A page that never loads what it is given. A detached document has no
 * browsing context, so an appended script is only recorded and no request
 * reaches Google from the test browser.
 * @returns {AnalyticsHost} A document and a window that are not the test's own.
 */
const createHost = (): AnalyticsHost => ({
  document: document.implementation.createHTMLDocument(""),
  window: {},
});

/**
 * The entries on the host's data layer, as gtag.js would read them.
 * @param host - The host the tag was installed into.
 * @returns {unknown[]} Every entry, in the order it was queued.
 */
const dataLayerOf = (host: AnalyticsHost): unknown[] => {
  const layer: unknown = Reflect.get(host.window, "dataLayer");
  return Array.isArray(layer) ? layer : [];
};

/**
 * The commands gtag() queued, each as the plain array of its arguments.
 * @param host - The host the tag was installed into.
 * @returns {unknown[][]} One array per queued command, in order.
 */
const queuedCommands = (host: AnalyticsHost): unknown[][] =>
  dataLayerOf(host).map((entry) =>
    Array.from(entry instanceof Object ? Object.values(entry) : []),
  );

const consentDefaults = (host: AnalyticsHost) =>
  queuedCommands(host).filter(
    ([name, action]) => name === "consent" && action === "default",
  );

const consentOf = (parameters: unknown) =>
  CONSENT_TYPES.map((type) => [type, Reflect.get(Object(parameters), type)]);

describe("installGoogleAnalytics", () => {
  test("loads nothing and queues nothing when there is no measurement ID", () => {
    const host = createHost();

    installGoogleAnalytics("", host);

    expect(host.document.scripts).toHaveLength(0);
    expect(Reflect.get(host.window, "dataLayer")).toBeUndefined();
  });

  test("loads the Google tag for the measurement ID without blocking the page", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    const [script, ...others] = Array.from(host.document.scripts);
    expect(others).toHaveLength(0);
    expect(script.src).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`,
    );
    expect(script.async).toBe(true);
  });

  test("configures the tag with the measurement ID", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    expect(
      queuedCommands(host).filter(([name]) => name === "config"),
    ).toEqual([["config", MEASUREMENT_ID]]);
  });

  test("denies every consent type for the EEA, the UK, and Switzerland", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    const regional = consentDefaults(host).filter(
      ([, , parameters]) => Reflect.get(Object(parameters), "region") !== undefined,
    );
    expect(regional).toHaveLength(1);
    const [[, , parameters]] = regional;
    expect(Reflect.get(Object(parameters), "region")).toEqual(CONSENT_REGIONS);
    expect(consentOf(parameters)).toEqual(
      CONSENT_TYPES.map((type) => [type, "denied"]),
    );
  });

  test("grants every consent type to visitors from everywhere else", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    const elsewhere = consentDefaults(host).filter(
      ([, , parameters]) => Reflect.get(Object(parameters), "region") === undefined,
    );
    expect(elsewhere).toHaveLength(1);
    const [[, , parameters]] = elsewhere;
    expect(consentOf(parameters)).toEqual(
      CONSENT_TYPES.map((type) => [type, "granted"]),
    );
  });

  test("declares both consent defaults before the tag is configured", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    const names = queuedCommands(host).map(([name]) => name);
    const firstConfig = names.indexOf("config");
    expect(firstConfig).toBeGreaterThan(-1);
    expect(consentDefaults(host)).toHaveLength(2);
    expect(names.lastIndexOf("consent")).toBeLessThan(firstConfig);
  });

  test("queues no event, because visits are the only thing measured", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    expect(
      queuedCommands(host).filter(([name]) => name === "event"),
    ).toEqual([]);
  });

  test("queues commands as the arguments objects gtag.js reads", () => {
    const host = createHost();

    installGoogleAnalytics(MEASUREMENT_ID, host);

    // gtag.js ignores a plain array pushed by hand; only the Arguments object
    // a gtag() call pushes is read as a command.
    const layer = dataLayerOf(host);
    expect(layer).not.toHaveLength(0);
    expect(layer.map((entry) => Object.prototype.toString.call(entry))).toEqual(
      layer.map(() => "[object Arguments]"),
    );
  });

  test("keeps what is already on the data layer", () => {
    const host = createHost();
    const existing = { event: "already-there" };
    Reflect.set(host.window, "dataLayer", [existing]);

    installGoogleAnalytics(MEASUREMENT_ID, host);

    expect(dataLayerOf(host)[0]).toBe(existing);
  });
});
