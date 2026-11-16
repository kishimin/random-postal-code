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

The MVP excludes authentication, user accounts, favorites, history synchronization, regional filters, GPS, location collection, social sharing, push notifications, payments, multilingual UI, and the Android and iOS apps. The mobile apps are developed now, in parallel with the Web MVP but outside it, under section 6.3 and Issues #12 through #15 and #20.

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
  mobile/         # Expo and React Native app for Android and iOS
  web/
    frontend/     # React, Vite, Pages, and browser-specific behavior
    backend/      # Hono, Workers, public API, and CORS
    contact-form/ # Apps Script bound to the Google contact form (Issue #105)
packages/
  shared/         # Pure types and validation contracts shared by clients and API
  postal-data/    # Japan Post data retrieval, normalization, and artifacts
```

The frontend and backend are separate projects that must support independent deployment and rollback. The frontend reads the public API URL from the build-time `VITE_API_BASE_URL` variable.

`apps/web/contact-form` holds the source of the Google Apps Script that runs inside the contact form's own script editor and posts one Discord message per response. It is not deployed by CI: the owner pastes `src/notify-discord.cjs` into the form once and attaches its trigger there. The file is a classic script, as Apps Script requires, and exports its functions to Node only when a `module` object exists, so the workspace can test it.

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

### 6.3 Mobile App Boundary

Android and iOS are one Expo (React Native) application in `apps/mobile`, tracked by Issues #12 through #15 and #20. On 2026-11-16 the owner moved it out of V2: it is developed now, in parallel with the Web MVP but outside it. The mobile app, including Expo, AdMob, UMP, and store delivery, must not delay, be bundled with, or become acceptance criteria for the Web MVP. When a Web MVP Issue under #22 can be started, it goes first.

- Each mobile Issue holds for both Android and iOS. iOS is verified by automated tests and by `expo export --platform ios` succeeding. No iPhone or Mac is available, so no iOS device or simulator check is required.
- Google Play delivery is Issue #20. App Store delivery is not planned. It is decided once the app is complete, because the Apple Developer Program has a yearly fee.
- Manual checks through Expo Go are not planned.

## 7. External Services and Failure Boundaries

Google Maps, AdSense, Google Analytics, and consent services are optional dependencies isolated from core Web behavior. Their failure must not make an already successful postal code, addresses, history, or regeneration unavailable.

- Only production has a Web Maps API key, restricted by HTTP referrer to the production origin and by API to the Maps Embed API. Development runs without a key, so the map falls back to its external link; a key that also allowed localhost would weaken the production restriction.
- Ads must not obscure primary actions or retry indefinitely.
- In regions that require consent, complete the selected Web consent flow before eligible ad requests.
- The Zipnami API neither receives nor stores advertising identifiers.
- Google Analytics 4 measures visits to the Web (Issue #92). Only production carries a measurement ID (`G-` format, built in as `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID` and supplied as `ZIPNAMI_WEB_GA_MEASUREMENT_ID`). A build without one, such as development, CI, and end-to-end test builds, loads no Analytics script and makes no request to Google Analytics.
  - The tag loads asynchronously and is never awaited. If it fails to load, is blocked, or never answers, core Web behavior is unaffected.
  - Google consent mode defaults are declared before the tag is configured: `denied` for the EEA, the UK, and Switzerland, and `granted` everywhere else. The visitor's choice then comes from the Google Privacy & messaging message shared with AdSense (Issue #39).
  - The application sends no custom events. Page views, including screen changes of the single-page application, are counted by the tag's enhanced measurement through browser history changes, so the application does not send `page_view` itself.
  - It processes page views, referrers, region, and device information, and may set the `_ga` cookies. The Zipnami API neither receives nor stores any of it.

## 8. Privacy and Accessibility

`/privacy` is divided into the five sections of its Figma frame: what is collected, what it is used for, advertising and analytics, history, and contact. It names Google Maps, AdSense, Google Analytics, and consent services, and documents browser-local history, the absence of location collection, and Japan Post attribution.

The contact method is a Google Form (Issue #105, moved into the MVP by the owner on 2026-11-15). The contact section links to the form and does not embed it, so the Content-Security-Policy is unchanged. It says the form is a Google service, which fields it asks for, that what is entered is used only to handle the inquiry, and that no reply is possible. The form collects no email address. Its Apps Script (section 3) sends Discord only the selected inquiry type and a link to the responses page; the name and the content never leave Google.

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
- Deploy automatically once `CI (Push)` succeeds for a push to `main`, deploying the commit CI verified (Issue #108). Each half deploys only when it changed since the commit that half last deployed successfully, as recorded by every deploy; documentation and acceptance tests deploy nothing, and anything shared deploys both. A half never automatically receives a commit older than the one it has live. A manual dispatch remains.
- Report a failed deploy or failed production tests to Discord with the rollback command. Nothing rolls back automatically.
- Run the production tests (Large, Issue #104) from Pages through Workers.
- Do not print secrets in deployment logs.
- Ensure Web advertising declarations and consent configuration match the production build.

## 11. Completion and Traceability

The MVP is complete when every MVP Issue under [tracker Issue #22](https://github.com/kishimin/random-postal-code/issues/22) is closed with its acceptance criteria satisfied, this design is satisfied, and reproducible final acceptance evidence is recorded. The mobile app Issues (section 6.3) and Issues marked `v2` are not required for MVP completion.

When the design changes, update this contract and its affected scope before synchronizing the corresponding Issue acceptance criteria and branch plan. If the reasoning or rejected alternatives behind a decision require long-term preservation, create an ADR instead of mixing decision history into this current-state design.

## 12. Details Resolved During Implementation

The following details are resolved during the owning Issue's Red/Green cycles without changing MVP externally observable behavior. They must not be guessed from this document alone.

| Detail                                                 | Owning Issue | Resolution gate                                                                                                                           |
| ------------------------------------------------------ | -----------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Exact package versions and quality commands            |           #1 | Verify official toolchain compatibility and fix them in the lockfile and workspace scripts                                                |
| Runtime-schema implementation                          |           #2 | Implement the API contracts without coupling shared code to a client or server framework                                                  |
| Postal artifact file format                            |           #3 | Verify determinism, Worker size constraints, and loading failures                                                                         |
| Web history keys and migration                         |           #7 | Fix the smallest first-release contract with persistence tests                                                                            |
| Production Pages origin, Worker URL, and project names |          #19 | Fix them from the provisioned Cloudflare resources and deployment configuration                                                           |
| Exact AdSense and consent configuration                |      #9, #39 | Human-review the production configuration before release. The consent platform is Google Privacy & messaging (decided on #39, 2026-10-17) |

External billing, API-key restrictions, and consent affect production accounts. Before release, a human must compare their configuration screens with the production Web build rather than relying only on automated output.
