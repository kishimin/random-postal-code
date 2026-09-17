# Zipnami Web MVP Design

## 1. Purpose

This document is the source of truth for the current Zipnami MVP product design and technical contracts. Implementation tasks and their acceptance criteria are tracked in [GitHub Issues](https://github.com/kishimin/random-postal-code/issues). Detailed contracts are defined in [api-design.md](./api-design.md) and [ui-design.md](./ui-design.md).

## 2. Product Scope

Zipnami selects a unique Japanese postal code uniformly at random from Japan Post public data and displays every address associated with that postal code on the Web.

The MVP includes:

- generating, regenerating, and copying a random postal code;
- displaying every address associated with the selected postal code;
- an embedded Google Map and external map links on the Web;
- browser-local history;
- Google AdSense on the Web;
- consent handling where required;
- a privacy policy and Japan Post data attribution; and
- distribution through Cloudflare Pages and Cloudflare Workers.

The MVP excludes authentication, user accounts, favorites, history synchronization, regional filters, GPS, location collection, social sharing, push notifications, payments, iOS, multilingual UI, and Android. Android and Google Play delivery are V2 work tracked by Issues #12 through #15 and #20.

## 3. System Architecture

```text
Japan Post CSV
      |
      v (build-time normalization)
packages/postal-data ---> apps/web/backend (Hono on Workers)
                                  |
                       GET /api/random over HTTPS
                         |
                         v
apps/web/frontend (React/Vite on Pages)
        |
 browser storage and Google Maps/AdSense
```

The repository is a Bun workspaces monorepo with these ownership boundaries:

```text
apps/
  web/
    frontend/     # React, Vite, Pages, and browser-specific behavior
    backend/      # Hono, Workers, public API, and CORS
  packages/
  shared/         # Pure types and validation contracts shared by clients and API
  postal-data/    # Japan Post data retrieval, normalization, and artifacts
```

The frontend and backend are separate projects that must support independent deployment and rollback. The frontend reads the public API URL from the build-time `VITE_API_BASE_URL` variable.

## 4. Domain and Data Contracts

### 4.1 Types

```ts
type Address = {
  prefecture: string;
  city: string;
  town: string;
};

type PostalCode = {
  postalCode: string; // Seven digits without a hyphen
  addresses: Address[];
};
```

### 4.2 Invariants

- The sampling population is unique seven-digit postal codes, not source CSV rows.
- Every unique postal code has the same selection probability.
- Every address for a postal code is retained in `addresses`.
- Only addresses with identical `prefecture`, `city`, and `town` values are deduplicated.
- Address order preserves first occurrence in the Japan Post source.
- Runtime address lookup does not depend on an external API.

### 4.3 Data Generation

The official Japan Post dataset is retrieved and normalized to UTF-8 at build time. The process produces a deterministic artifact that satisfies the invariants above: the same input must produce the same content and order. The source, retrieval date, transformation, and update procedure must be documented.

## 5. API Contract

### 5.1 Random Postal Code

```http
GET /api/random
Accept: application/json
```

On success, the API returns `200 application/json` with a `PostalCode` value.

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

The API does not provide authentication, history persistence, search, filters, or write operations. A data-loading failure must return a JSON error response instead of appearing successful. [api-design.md](./api-design.md) defines the shared error envelope and status mapping.

### 5.2 CORS and Configuration

- Production permits only configured Pages origins by exact match.
- Origin comparison includes scheme, host, and port; prefix and substring matching are prohibited.
- `Access-Control-Allow-Origin: *` is prohibited.
- Development permits only the explicitly configured Vite origin.
- Allowed methods and headers are limited to those required by `GET /api/random`.
- Worker secrets must not appear in frontend environment variables, distributed assets, or Git history.

## 6. Client Design

### 6.1 Web States

The Web client distinguishes at least these states:

- Initial: show the generate action without fetching automatically.
- Loading: communicate progress and prevent duplicate submission.
- Success: display the postal code and every address.
- Error: distinguish offline, API, and malformed-response failures and allow retry.

A successful regeneration replaces the current result and prepends it to history. A failure must not unnecessarily discard the last successful result.

### 6.2 Web

- Use a React, TypeScript, and Vite SPA.
- Support direct navigation and refresh through Pages SPA fallback.
- Display the selected address through Maps Embed API and provide an external map link for every address.
- Copy the postal code to the clipboard.
- Store history only in the browser, newest first, retaining duplicates, with a maximum of 20 entries.
- When adding entry 21, remove the oldest entry.

### 6.3 Android V2 Boundary

Android, Expo, AdMob, UMP, and Google Play delivery are not part of the Web MVP. Their existing requirements remain tracked as V2 in Issues #12 through #15 and #20. They must not delay, be bundled with, or become acceptance criteria for the Web MVP.

## 7. External Services and Failure Boundaries

Google Maps, AdSense, and consent services are optional dependencies isolated from core Web behavior. Their failure must not make an already successful postal code, addresses, history, or regeneration unavailable.

- Separate production and development Web Maps API keys and restrict each by HTTP referrer and Maps Embed API.
- Ads must not obscure primary actions or retry indefinitely.
- In regions that require consent, complete the selected Web consent flow before eligible ad requests.
- The Zipnami API neither receives nor stores advertising identifiers.

## 8. Privacy and Accessibility

`/privacy` distinguishes data stored by Zipnami from data processed by Google Maps, AdSense, and consent services. It documents browser-local history, the absence of location collection, Japan Post attribution, and a contact method.

The Web uses semantic HTML, keyboard-operable controls, visible focus, meaningful names, and appropriate announcements for dynamic results and errors. State is not conveyed by color alone. Advertising areas are distinguishable from application content.

## 9. Quality and Test Design

Code changes proceed one behavior at a time from a test list through Red, Green, and Refactor. Tests express observable contracts instead of implementation details.

Test size is classified as Small, Medium, or Large by actual dependencies, not by tools or labels such as unit or E2E. After the repository defines its naming convention, use `.small.test.ts`, `.medium.test.ts`, and `.large.test.ts`.

At minimum, verify:

- normalization: grouping, identical-address deduplication, order, multiple addresses, and determinism;
- selection: unique postal codes are the sampling unit and source row counts do not bias selection;
- API: success, data failure, invalid state, and permitted and denied CORS origins;
- UI: initial, loading, success, regeneration, error, history, maps, and optional dependency failure;
- security: secrets are absent from distributed assets and origins require exact matches; and
- release: Pages-to-Workers flow, privacy publication, and Web advertising configuration.

Before completing a code branch, run every repository-defined formatter, type check or compiler, linter or static analyzer, test, coverage task, and production build relevant to the change. Every metric in the overall coverage summary must be at least 80%. Do not invent missing commands; record why an unavailable check was skipped.

## 10. Deployment and Operations

- Frontend: deploy `apps/web/frontend` statically to Cloudflare Pages.
- Backend: deploy `apps/web/backend` as an independent Cloudflare Worker.
- Deploy and roll back Pages and Workers independently.
- Run a production smoke check from Pages through Workers.
- Do not print secrets in deployment logs.
- Ensure Web advertising declarations and consent configuration match the production build.

## 11. Completion and Traceability

The MVP is complete when every MVP Issue under [tracker Issue #22](https://github.com/kishimin/random-postal-code/issues/22) is closed with its acceptance criteria satisfied, this design is satisfied, and reproducible final acceptance evidence is recorded. Issues marked `v2` are not required for MVP completion.

When the design changes, update this contract and its affected scope before synchronizing the corresponding Issue acceptance criteria and branch plan. If the reasoning or rejected alternatives behind a decision require long-term preservation, create an ADR instead of mixing decision history into this current-state design.

## 12. Details Resolved During Implementation

The following details are resolved during the owning Issue's Red/Green cycles without changing MVP externally observable behavior. They must not be guessed from this document alone.

| Detail | Owning Issue | Resolution gate |
| --- | ---: | --- |
| Exact package versions and quality commands | #1 | Verify official toolchain compatibility and fix them in the lockfile and workspace scripts |
| Runtime-schema implementation | #2 | Implement the API contracts without coupling shared code to a client or server framework |
| Postal artifact file format | #3 | Verify determinism, Worker size constraints, and loading failures |
| Web history keys and migration | #7 | Fix the smallest first-release contract with persistence tests |
| Production Pages origin, Worker URL, and project names | #19 | Fix them from the provisioned Cloudflare resources and deployment configuration |
| Exact AdSense and consent configuration | #9 | Human-review the production configuration before release |

External billing, API-key restrictions, and consent affect production accounts. Before release, a human must compare their configuration screens with the production Web build rather than relying only on automated output.
