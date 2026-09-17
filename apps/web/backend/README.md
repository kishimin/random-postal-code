# Zipnami Web Backend

Hono API deployed as a Cloudflare Worker. The public contract, error envelope,
CORS boundary, and layering are defined in
[api-design.md](../../../docs/api-design.md); this package implements them.

## Getting started

```sh
bun install        # from the repository root
bun run dev        # wrangler dev
```

## Commands

| Command                                             | Purpose                                               |
| --------------------------------------------------- | ----------------------------------------------------- |
| `bun run dev`                                       | Run the Worker locally through wrangler               |
| `bun run build`                                     | Bundle the Worker without deploying (`--dry-run`)     |
| `bun run deploy`                                    | Deploy the Worker                                     |
| `bun run typecheck`                                 | `tsc -b --noEmit`                                     |
| `bun run lint`                                      | `oxlint`, then `eslint`                               |
| `bun run test`                                      | Vitest inside the Workers runtime                     |
| `bun run test:small` / `test:medium` / `test:large` | Run one test size with coverage                       |
| `bun run test:coverage:pr`                          | Small and medium tests with an 80% coverage threshold |
| `bun run cf:typegen`                                | Regenerate Worker types from `wrangler.jsonc`         |

Every command is also reachable from the repository root, which delegates
through the Bun workspace.

## Structure

```text
src/
  index.ts          # Worker entry point, named by api-design.md section 2
  app.ts            # Hono application factory; dependencies are injected
  controllers/      # HTTP in, application call out; no selection logic
  services/         # Application behavior, such as uniform random selection
  repositories/     # Ports the application depends on
  infrastructures/  # Adapters: dataset loading, failure translation
  models/           # Domain types and invariants, free of HTTP and framework
  shared/           # Errors and logging
tests/              # Tests that span more than one layer
```

The direction is one-way: a controller may reach a service, a service may reach
a repository port, and only the infrastructure layer knows where the dataset
comes from. Nothing below `controllers/` imports Hono.

Shared contracts live in [`packages/shared`](../../../packages/shared) rather
than here, so the Web client can import the same schemas without inheriting
Hono or Cloudflare types.

## Testing

Tests execute inside workerd through `@cloudflare/vitest-pool-workers`, reading
`wrangler.jsonc` so the test environment and the deployed Worker are configured
from one file. A behavior that depends on the Workers runtime therefore fails
here rather than only in production.

Coverage uses the istanbul provider. The v8 provider used elsewhere in this
repository needs a `node:inspector` Session, which workerd does not implement.

`compatibility_date` must not exceed the newest date the bundled workerd
supports, or the local runtime refuses to start.
