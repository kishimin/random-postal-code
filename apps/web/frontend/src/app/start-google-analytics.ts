import {
  installGoogleAnalytics,
  type AnalyticsHost,
} from "../features/analytics/google-analytics";
import { parseAppEnv } from "./schemas/env.schema";

/**
 * Installs Google Analytics for the measurement ID the build was made with.
 *
 * Never throws. Analytics is an optional dependency (design.md section 7),
 * so whatever goes wrong here must not stop the application from starting.
 * @param {Record<string, unknown>} env - The build-time environment, as `import.meta.env`.
 * @param {AnalyticsHost} host - The page to install the tag into; this page by default.
 */
export const startGoogleAnalytics = (
  env: Record<string, unknown>,
  host: AnalyticsHost = { document, window },
): void => {
  try {
    installGoogleAnalytics(parseAppEnv(env).googleAnalyticsMeasurementId, host);
  } catch {
    // Nothing to report to: the visitor cannot act on a failed measurement.
  }
};
