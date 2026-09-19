/*
 * Canonical contracts shared by the Web client and the API.
 *
 * api-design.md section 3 requires this package to stay free of React, React
 * Native, Hono, and Cloudflare dependencies, so both sides can import the same
 * schemas without inheriting the other side's runtime.
 *
 * The schemas themselves — Address, PostalCode, and the error envelope — are
 * written by Issue #2 from the acceptance criteria that own them. zod is the
 * runtime-schema library: types are inferred from the schemas rather than
 * declared beside them, and the OpenAPI document is derived from the same
 * schemas instead of being maintained separately.
 */

export {};
