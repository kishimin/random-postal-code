/**
 * Generates one request-scoped identifier.
 *
 * api-design.md section 4.2 requires the same id in the `X-Request-Id`
 * header and the error envelope's `requestId`, and section 7 requires it in
 * structured logs. A wrapper around the platform UUID generator keeps every
 * one of those call sites from choosing an ID scheme independently, and
 * gives the Workers runtime's `crypto.randomUUID()` one place to be
 * replaced from if that ever changes.
 */
export const generateRequestId = (): string => crypto.randomUUID();
