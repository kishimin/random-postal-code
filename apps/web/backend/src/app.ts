import { Hono } from "hono";

/**
 * Builds the Hono application.
 *
 * Dependencies are passed in rather than constructed here so a test can supply
 * a substitute repository without reaching into module state. api-design.md
 * section 5 fixes the direction: the controller maps HTTP to the service, the
 * service selects, and only the infrastructure layer knows where the dataset
 * comes from.
 *
 * Routes, the error envelope, and CORS are added by Issues #4 and #11 from the
 * acceptance tests that define them. This factory exists so the toolchain can
 * be verified before any of that behavior is written.
 */
export const createApp = () => {
  return new Hono();
};
