# Zipnami Web Frontend

React, TypeScript, and Vite SPA deployed to Cloudflare Pages. It consumes the Zipnami public API
defined in [api-design.md](../../../docs/api-design.md) and implements the interface contract in
[ui-design.md](../../../docs/ui-design.md).

## Getting started

```sh
bun install                 # from the repository root
cp .env.example .env        # already points at the local backend
```

Then run the two servers in separate terminals, from the repository root:

```sh
bun run dev:api             # Hono on the Workers runtime, port 8787
bun run dev                 # Vite, which calls the address in .env
```

`.env.example` needs no edit for local development: the port it names is the one
`apps/web/backend/wrangler.jsonc` pins for `wrangler dev`. A root-level test holds the two in
agreement, so a change to either shows up as a failure rather than as a request that never arrives.

`VITE_API_BASE_URL` is read at build time. It must not contain secrets: everything in this package
ships to the browser.

## Commands

| Command                                             | Purpose                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `bun run dev`                                       | Vite development server                                               |
| `bun run build`                                     | Type check, then build `dist/` for Cloudflare Pages                   |
| `bun run preview`                                   | Serve the production build on port 4173                               |
| `bun run typecheck`                                 | `tsc -b --noEmit` across both project references                      |
| `bun run lint`                                      | `oxlint`, then `eslint` with the rules oxlint already covers disabled |
| `bun run lint:markup`                               | markuplint over JSX, for HTML semantics                               |
| `bun run test`                                      | Vitest unit project in headless Chromium                              |
| `bun run test:small` / `test:medium` / `test:large` | Run one test size with coverage                                       |
| `bun run test:storybook`                            | Run stories as tests, including the a11y addon                        |
| `bun run test:coverage:pr`                          | Small and medium tests with an 80% coverage threshold                 |
| `bun run storybook`                                 | Storybook on port 6006                                                |
| `bun run e2e`                                       | Playwright against the preview build and Storybook                    |
| `bun run mutation-test`                             | Stryker mutation testing                                              |

Every command is also reachable from the repository root, which delegates through the Bun workspace.

## Structure

```text
src/
  api/          # Shared API client configuration and MSW mocks
  app/          # Routing and application composition; depends on features, never the reverse
    providers/  # Composition of the providers every view needs
    routes/     # Route definitions
    schemas/    # App-wide schemas such as environment validation
    tests/      # Routing and application-level integration tests
    views/      # Page-level views composed from features
  components/   # Feature-independent shared UI
  features/     # One directory per feature; never imports another feature
  hooks/        # Hooks shared by more than one feature
  images/       # Imported image assets
  lib/          # Thin wrappers and configuration for third-party libraries
  models/       # API domain types and conversions
  providers/    # Individual reusable provider implementations
  schemas/      # Validation schemas shared by more than one feature
  tests/        # Shared test infrastructure
  theme/        # Design tokens and Tailwind theme
  types/        # UI-only types shared by more than one feature
  utils/        # Pure functions with no third-party dependencies
e2e/            # Playwright specs, page objects, selectors, and fixtures
```

`public/` holds unprocessed files served as-is. Import images from `src/images/` instead.

These boundaries are enforced by `eslint-plugin-boundaries`, not only by convention: `shared` code
cannot import `features/` or `app/`, a feature cannot import another feature, and nothing can import
`app/`.

## Acceptance tests

System-level acceptance tests live in `acceptance/` at the repository root, not here. They are fixed
before implementation and must not change while the implementation is written.
