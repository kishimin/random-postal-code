# Zipnami

A Japanese postal-code randomizer. Press one button, get a real postal code and the
addresses it covers.

This repository is a [Bun workspaces](https://bun.com/docs/install/workspaces) monorepo.
The Web frontend and the Web API are separate projects that deploy and roll back
independently, as [design.md](./docs/design.md) section 3 requires.

```text
apps/web/frontend     React, Vite, Cloudflare Pages
apps/web/backend      Hono, Cloudflare Workers, the public API
packages/shared       Types and validation contracts both sides use
```

## Getting started

```sh
bun install
cp apps/web/frontend/.env.example apps/web/frontend/.env
```

Then run the two servers in separate terminals:

```sh
bun run dev:api     # Hono on the Workers runtime, port 8787
bun run dev         # Vite, which calls the address in .env
```

`.env.example` needs no edit: the port it names is the one
`apps/web/backend/wrangler.jsonc` pins for `wrangler dev`, and a test holds the two in
agreement.

## Commands

Every command runs from the repository root and delegates through the workspace, so a
package added later is picked up without changing them.

| Command                    | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `bun run format`           | Rewrite every file to the Prettier style                             |
| `bun run format:check`     | Fail instead of rewriting, for CI                                    |
| `bun run typecheck`        | `tsc -b --noEmit` across every package                               |
| `bun run lint`             | oxlint, then ESLint, then the acceptance tests                       |
| `bun run lint:markup`      | markuplint over JSX, for HTML semantics                              |
| `bun run test`             | Every package's default test run                                     |
| `bun run test:small`       | One size at a time; also `bun run test:medium`, `bun run test:large` |
| `bun run test:coverage:pr` | Small and medium tests against the coverage threshold                |
| `bun run test:eslint`      | The repository's own ESLint rules                                    |
| `bun run test:config`      | Contracts between packages and the platforms they deploy to          |
| `bun run build`            | Build every package for deployment                                   |
| `bun run e2e:medium`       | Acceptance tests in five browser projects                            |
| `bun run storybook`        | Storybook on port 6006                                               |

`bun run test:config` and `bun run test:eslint` run at the root rather than in a
package, because what they hold spans packages or has no package at all.

This table is the set of commands worth knowing, not every script. `package.json` has
the full list, and CI runs a few that are not here.

## Tests

Test files are named by size — `.small.`, `.medium.`, `.large.` — and the size is
decided by how far the dependencies reach, not by how much code is under test.
[ui-design.md](./docs/ui-design.md) section 11 sets what belongs in each.

Acceptance tests live in `acceptance/` at the repository root. They are fixed before
the implementation is written, and a pull request that modifies one fails CI: the check
compares `acceptance/` against the merge base, so committing the edit does not hide it.
An implementation that cannot pass them is the thing that has to change.

Some editors also refuse the write outright, but that depends on the machine. The CI
check does not.

## Where decisions are written

| Question                       | Answer lives in                             |
| ------------------------------ | ------------------------------------------- |
| What must be true to be done   | The GitHub Issue's `## Acceptance criteria` |
| How the pieces fit together    | [design.md](./docs/design.md)               |
| What the API promises          | [api-design.md](./docs/api-design.md)       |
| What the interface must do     | [ui-design.md](./docs/ui-design.md)         |
| How to work in this repository | [CLAUDE.md](./CLAUDE.md)                    |

There is no `docs/ACCEPTANCE.md` and no `docs/PRD.md`. The same criteria written in two
places means one of them is out of date, and nothing says which.
