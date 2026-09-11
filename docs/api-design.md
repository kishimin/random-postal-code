# Zipnami API Design

## 1. Scope and Ownership

This document is the source of truth for the Zipnami public API contract and backend boundaries. It refines the system contract in [design.md](./design.md) and the acceptance criteria in Issues [#2](https://github.com/kishimin/random-postal-code/issues/2), [#3](https://github.com/kishimin/random-postal-code/issues/3), [#4](https://github.com/kishimin/random-postal-code/issues/4), and [#11](https://github.com/kishimin/random-postal-code/issues/11).

The API owns random selection from the normalized dataset, HTTP response mapping, CORS, and operational error reporting. It does not own UI state, client history, maps, advertising, authentication, search, or runtime retrieval from Japan Post.

## 2. Runtime Boundary

- Runtime: Cloudflare Workers
- HTTP framework: Hono
- Entry point: `apps/web/backend/src/index.ts`
- Public base URL: supplied to clients independently of the frontend deployment
- Transport: HTTPS only in deployed environments
- API prefix: `/api`
- Representation: JSON encoded as UTF-8

Pages and Workers are separate deployments. The Worker must not serve the SPA, and the Pages application must not proxy API requests in production.

## 3. Shared Contracts

The canonical TypeScript schemas and inferred types live in `packages/shared` without React, React Native, Hono, or Cloudflare dependencies.

```ts
type Address = {
  prefecture: string;
  city: string;
  town: string;
};

type PostalCode = {
  postalCode: string;
  addresses: [Address, ...Address[]];
};

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "DATA_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
};
```

Runtime schemas validate all data entering or leaving an HTTP boundary. `postalCode` must match `^[0-9]{7}$`. Each address field is a string and `addresses` is non-empty. The data generator is responsible for producing complete normalized records; the API must reject an invalid artifact rather than emit a partial success.

## 4. Endpoint Contract

### 4.1 `GET /api/random`

Returns one uniformly selected unique postal code and every normalized address associated with it.

Request:

```http
GET /api/random HTTP/1.1
Accept: application/json
```

The endpoint accepts no path parameter, query parameter, or request body. Unknown query parameters are rejected with `400` so misspelled or unsupported filters do not silently change client expectations.

Success:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-Request-Id: 01JEXAMPLE0000000000000000
```

```json
{
  "postalCode": "1000001",
  "addresses": [
    {
      "prefecture": "Tokyo",
      "city": "Chiyoda City",
      "town": "Chiyoda"
    }
  ]
}
```

`Cache-Control: no-store` prevents an intermediary from turning repeated generation actions into a cached result. Receiving the same postal code on consecutive requests remains valid because selection is random.

### 4.2 Error Responses

| Condition | Status | Code | Retry guidance |
| --- | ---: | --- | --- |
| Unsupported query parameter or request body | 400 | `INVALID_REQUEST` | Correct the request; do not retry unchanged |
| Dataset missing, unreadable, empty, or invalid | 503 | `DATA_UNAVAILABLE` | Retry may succeed after deployment recovery |
| Unexpected application failure | 500 | `INTERNAL_ERROR` | Retry with bounded backoff |
| Unknown route | 404 | `NOT_FOUND` | Do not retry unchanged |
| Unsupported method on `/api/random` | 405 | `METHOD_NOT_ALLOWED` | Use `GET` |

The stable error envelope applies to application failures:

```json
{
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Postal code data is temporarily unavailable.",
    "requestId": "01JEXAMPLE0000000000000000"
  }
}
```

Messages are safe, non-sensitive English text. Responses never expose stack traces, artifact paths, environment values, framework errors, or third-party details. The same request ID is returned in `X-Request-Id` and the JSON envelope and is included in structured server logs.

All JSON errors use this envelope. Hono's default text or HTML error responses must not cross the public API boundary.

## 5. Selection and Data Loading

```text
HTTP Controller
      |
      v
RandomPostalCodeService
      |
      v
PostalCodeRepository (port)
      |
      v
GeneratedDatasetRepository (infrastructure)
```

- The model defines `Address`, `PostalCode`, and their invariants without HTTP or framework imports.
- `PostalCodeRepository` exposes the normalized collection to the application layer without leaking file or Worker binding types.
- `RandomPostalCodeService` selects one index uniformly from the number of unique postal codes.
- `GeneratedDatasetRepository` loads and validates the build-time artifact and translates infrastructure failures to `DataUnavailable`.
- The controller accepts the request, invokes the service, and maps application results to HTTP only.

The normalized dataset is loaded once per Worker isolate when practical and treated as immutable. Initialization must not perform a runtime network request. A failed initialization remains an explicit unavailable state; it must not fall back to an empty success payload.

Random selection uses an unbiased integer in `[0, count)`. Implementations must avoid rounding an inclusive upper bound and must not sample source rows. Statistical tests do not prove randomness; deterministic boundary tests verify index mapping, while a focused distribution check may detect obvious weighting regressions.

## 6. CORS and HTTP Security

- Allow only exact configured Web origins, including scheme, host, and port.
- Return the requesting origin only after an exact allowlist match; never return `*`.
- Include `Vary: Origin` whenever the response varies by Origin.
- Permit `GET` and the minimum headers needed by the browser client.
- Handle `OPTIONS` only when required by the CORS middleware; it is not a product endpoint.
- Reject unsupported methods and overlong URLs or headers through platform/framework limits.
- Set `X-Content-Type-Options: nosniff` on API responses.
- Do not trust client-supplied forwarding headers or a client-supplied request ID for security decisions.
- Keep development and production origin allowlists separate and fail startup or request handling safely when required configuration is absent.

The public read-only endpoint has no credentials and uses no cookies. Therefore it does not enable credentialed CORS and has no CSRF-sensitive mutation. If authentication or write operations are introduced later, they require a new threat review and contract.

## 7. Observability and Privacy

Structured logs contain timestamp, generated request ID, route, method, status, duration, and a bounded error code. They do not contain complete response bodies, addresses, environment secrets, advertising identifiers, or untrusted headers. Logs distinguish dataset unavailability from unexpected failures.

The MVP defines no application-level rate limit because the endpoint performs an in-memory read and random selection. Cloudflare platform limits still apply. Add explicit admission or rate controls only from measured abuse or capacity evidence and document their status and retry contract before activation.

## 8. Test Contract

Tests cover:

- shared schema acceptance and rejection, including seven digits and non-empty addresses;
- exact-address preservation and invalid artifact rejection;
- first and last selectable indices and unique-postal-code sampling;
- success headers and payload;
- `400`, `404`, `405`, `500`, and `503` mappings without internal detail leakage;
- exact allowed origins, denied origins, `Vary: Origin`, and absence of wildcard CORS;
- no runtime request to Japan Post or another address API;
- one immutable dataset load per isolate where the runtime permits deterministic observation; and
- Pages-to-Workers and Android-to-Workers release journeys.

Classify each test as Small, Medium, or Large by its actual dependencies, including Hono and Worker-runtime tests. Do not classify by the label API, integration, or E2E alone.

## 9. Unresolved Implementation Details

The following remain owned by their implementation Issues:

- the runtime-schema library and exact generated artifact format;
- the request ID generator and Cloudflare trace correlation;
- exact platform URL and header-size limits; and
- measured need for application-level capacity protection.

Resolving these details must not weaken the public contracts or expose infrastructure types through `packages/shared`.
