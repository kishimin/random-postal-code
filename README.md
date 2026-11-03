<div id="top"></div>

# Zipnami

Show a random real Japanese postal code, with every address it covers, at the press of one button.

## Tech Stack

<p style="display: inline">
  <img src="https://img.shields.io/badge/-TypeScript-3178C6.svg?logo=typescript&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-Bun-000000.svg?logo=bun&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-React-61DAFB.svg?logo=react&style=for-the-badge&logoColor=black">
  <img src="https://img.shields.io/badge/-Vite-646CFF.svg?logo=vite&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-Hono-E36002.svg?logo=hono&style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/-Cloudflare%20Workers-F38020.svg?logo=cloudflareworkers&style=for-the-badge&logoColor=white">
</p>

## Table of Contents

1. [About the Project](#about-the-project)
2. [Environment](#environment)
3. [Directory Structure](#directory-structure)
4. [Getting Started](#getting-started)
5. [Usage](#usage)
6. [API Endpoints](#api-endpoints)
7. [Available Commands](#available-commands)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Documentation](#documentation)
11. [Troubleshooting](#troubleshooting)

## About the Project

Zipnami picks one postal code uniformly at random from Japan Post's data and shows it with its addresses:

- **Postal code**: a seven-digit code such as `1000001`. Selection is uniform over unique postal codes, not over source rows, so a code that covers many addresses is no more likely than one that covers a single address.
- **Address**: a `prefecture`, `city`, and `town`. One postal code can cover more than one address, and the API returns all of them.
- **Dataset**: the normalized artifact built from Japan Post's `KEN_ALL.CSV` at build time and bundled into the Worker. The Worker never calls Japan Post or any other address service at runtime.
- **Web frontend** and **Web API**: two projects that deploy and roll back independently, as [design.md](./docs/design.md) section 3 requires. The frontend is a static Cloudflare Pages site, and the API is a Cloudflare Worker.

The Web app generates a code, copies it, keeps a history of earlier results in the browser, and shows each address on an embedded Google Map with a link to open it in Google Maps. It also has a privacy page and a reserved AdSense slot. If Maps, advertising, or consent fails, the postal code, its addresses, and the history stay usable.

The committed dataset is still a small hand-built source shaped like `KEN_ALL.CSV`. The tooling to retrieve and normalize the full Japan Post archive exists, but the switch to the full dataset has not been made yet; see [packages/postal-data/README.md](./packages/postal-data/README.md).

<p align="right">(<a href="#top">back to top</a>)</p>

## Environment

| Language / Framework | Version  |
| -------------------- | -------- |
| Bun                  | 1.3.13   |
| TypeScript           | 6.0.3    |
| React                | 19.3.0   |
| Vite                 | 7.3.1    |
| TanStack Router      | 1.170.38 |
| Tailwind CSS         | 4.3.3    |
| Hono                 | 4.13.8   |
| Wrangler             | 4.134.0  |
| Zod                  | 4.6.5    |

Bun's version is the one CI installs (`.github/actions/setup-frontend/action.yml`). The others are the versions `bun.lock` resolves. See `package.json` in the repository root and in each workspace for the full dependency list.

<p align="right">(<a href="#top">back to top</a>)</p>

## Directory Structure

```text
.
├── .github
│   ├── actions
│   ├── scripts
│   └── workflows
├── acceptance
│   ├── fixtures
│   ├── pages
│   └── selectors
├── apps
│   └── web
│       ├── backend
│       └── frontend
├── assets
├── docs
├── packages
│   ├── postal-data
│   └── shared
├── CLAUDE.md
├── README.md
├── bun.lock
└── package.json
```

### Main Directories

| Directory              | Description                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `acceptance`           | Acceptance tests fixed before implementation, with their fixtures, page objects, and selectors                  |
| `apps/web/frontend`    | React SPA deployed to Cloudflare Pages ([README](./apps/web/frontend/README.md))                                |
| `apps/web/backend`     | Hono API deployed as a Cloudflare Worker ([README](./apps/web/backend/README.md))                               |
| `packages/shared`      | Schemas and types both the frontend and the backend use                                                         |
| `packages/postal-data` | Japan Post data retrieval, normalization, and the committed source ([README](./packages/postal-data/README.md)) |
| `assets`               | Logo and favicon sources                                                                                        |
| `docs`                 | Design contracts, the deployment procedure, and the release checklist                                           |
| `.github/workflows`    | CI on pull requests, pushes, and nightly, plus the manual deploy and rollback workflows                         |

<p align="right">(<a href="#top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Bun 1.3.13, the version CI uses.
- Node.js. `bun run test:eslint` and `bun run test:config` run with `node --test`. The repository does not pin a Node.js version.

### Clone the Repository

```bash
git clone https://github.com/kishimin/random-postal-code.git
cd random-postal-code
```

### Create the Local Settings

The frontend reads the API address from `.env`. The Worker reads the origins it authorizes for CORS from `.dev.vars`. Both example files already point at the local servers, so they need no edit.

```bash
cp apps/web/frontend/.env.example apps/web/frontend/.env
cp apps/web/backend/.dev.vars.example apps/web/backend/.dev.vars
```

On Windows PowerShell:

```powershell
Copy-Item apps/web/frontend/.env.example apps/web/frontend/.env
Copy-Item apps/web/backend/.dev.vars.example apps/web/backend/.dev.vars
```

`.env.example` leaves the Google Maps key empty. The app still builds and works, and the map region shows its fallback instead of an embedded map.

### Install Dependencies

```bash
bun install
```

The frontend's Vitest unit project and the Playwright tests run in real browsers. Install them once:

```bash
cd apps/web/frontend
bunx playwright install
cd ../../..
```

### Run Tests

```bash
bun run test:small
bun run test:medium
```

### Start the Application

Run the two servers in separate terminals, from the repository root:

```bash
bun run dev:api
```

```bash
bun run dev
```

`dev:api` runs the Worker under `wrangler dev` on port 8787, which `apps/web/backend/wrangler.jsonc` pins. `dev` runs Vite, which calls the address in `.env`. Open:

```text
http://localhost:5173
```

<p align="right">(<a href="#top">back to top</a>)</p>

## Usage

With `bun run dev:api` running, request a random postal code from the API. Save this as `random.ts` and run `bun random.ts`:

```ts
const response = await fetch("http://localhost:8787/api/random", {
  headers: { Accept: "application/json" },
});

console.log(response.status, await response.json());
```

A successful response is `200` with one postal code and every address it covers. The code differs from run to run; for example:

```json
{
  "postalCode": "1000001",
  "addresses": [
    { "prefecture": "東京都", "city": "千代田区", "town": "千代田" }
  ]
}
```

The request above sends no `Origin` header, so CORS does not apply. A browser page can read the response only from an origin listed in the Worker's `ALLOWED_ORIGINS`.

<p align="right">(<a href="#top">back to top</a>)</p>

## API Endpoints

[api-design.md](./docs/api-design.md) is the full contract.

| Method | Path              | Description                                                        |
| ------ | ----------------- | ------------------------------------------------------------------ |
| `GET`  | `/api/random`     | Return one uniformly selected postal code and all of its addresses |
| `POST` | `/api/csp-report` | Receive the browser's Content-Security-Policy violation reports    |

### Request Body

`GET /api/random` takes no path parameter, query parameter, or body. Any query parameter is answered with `400 INVALID_REQUEST`.

`POST /api/csp-report` is sent by browsers through the frontend's report-only policy, not by application code.

| Field              | Required                            | Default | Description                                                          |
| ------------------ | ----------------------------------- | ------- | -------------------------------------------------------------------- |
| `csp-report`       | Yes, for `application/csp-report`   | -       | A `report-uri` style violation object                                |
| (array of reports) | Yes, for `application/reports+json` | -       | A Reporting API array; only `type: "csp-violation"` entries are read |

The CSP report endpoint answers `204` with no body. It accepts at most 16 KiB, declared or read, and answers `413` beyond that. A content type other than the two above gets `415`, and a body that is not a report of its declared type gets `400`. It logs at most 20 violations per request, plus one entry counting any it dropped.

Every error from either endpoint uses the same JSON envelope, with the request ID repeated in the `X-Request-Id` header:

```json
{
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Postal code data is temporarily unavailable.",
    "requestId": "01JEXAMPLE0000000000000000"
  }
}
```

| Condition                                      | Status | Code                 |
| ---------------------------------------------- | -----: | -------------------- |
| Unsupported query parameter or request body    |    400 | `INVALID_REQUEST`    |
| Unknown route                                  |    404 | `NOT_FOUND`          |
| Unsupported method                             |    405 | `METHOD_NOT_ALLOWED` |
| Dataset missing, unreadable, empty, or invalid |    503 | `DATA_UNAVAILABLE`   |
| Unexpected application failure                 |    500 | `INTERNAL_ERROR`     |

Successful responses carry `Cache-Control: no-store`, so repeated generations are never served from a cache. There is no application-level rate limit; Cloudflare's platform limits apply.

<p align="right">(<a href="#top">back to top</a>)</p>

## Available Commands

Every command runs from the repository root and delegates through the Bun workspace, so a package added later is picked up without changing them.

| Command                     | Description                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| `bun run test`              | Every package's default test run                                                 |
| `bun run test:small`        | Small tests in every package; also `test:medium` and `test:large`                |
| `bun run test:storybook`    | Stories as tests, including the accessibility addon                              |
| `bun run test:coverage:pr`  | Small and medium tests against the 80% coverage threshold                        |
| `bun run test:eslint`       | The repository's own ESLint rules                                                |
| `bun run test:config`       | Contracts between packages and the platforms they deploy to                      |
| `bun run e2e:medium`        | Playwright acceptance tests in five browser projects against a stubbed API       |
| `bun run e2e:large`         | End-to-end journeys against a production build and a real local Worker           |
| `bun run format`            | Rewrite every file to the Prettier style                                         |
| `bun run format:check`      | Fail instead of rewriting, for CI                                                |
| `bun run typecheck`         | `tsc -b --noEmit` across every package                                           |
| `bun run lint`              | oxlint, then ESLint, in every package and over `acceptance/`                     |
| `bun run lint:markup`       | markuplint over JSX, for HTML semantics                                          |
| `bun run check:postal-data` | Fail if the generated postal-code artifact has drifted from its committed source |
| `bun run dev:api`           | The Worker under `wrangler dev`, on port 8787                                    |
| `bun run dev`               | The Vite development server                                                      |
| `bun run storybook`         | Storybook on port 6006                                                           |
| `bun run build`             | Build every package for deployment                                               |
| `bun run preview`           | Serve the frontend's production build                                            |

This table is the set of commands worth knowing, not every script. `package.json` has the full list.

<p align="right">(<a href="#top">back to top</a>)</p>

## Testing

Test files are named by size (`.small.`, `.medium.`, `.large.`), and the size is decided by how far the dependencies reach, not by how much code is under test. [ui-design.md](./docs/ui-design.md) section 11 sets what belongs in each.

Acceptance tests live in `acceptance/`. They are fixed before the implementation is written, and a pull request that modifies one fails CI: the check compares `acceptance/` against the merge base, so committing the edit does not hide it. An implementation that cannot pass them is the thing that has to change.

<p align="right">(<a href="#top">back to top</a>)</p>

## Deployment

The frontend and the Worker deploy through the manual `deploy.yml` workflow, only from `main`, and roll back separately through `rollback.yml`. Every production value comes from the `production` GitHub Environment, so none is committed. [docs/deployment.md](./docs/deployment.md) has the one-time setup, the deploy and rollback commands, and the smoke check. [docs/release-checklist.md](./docs/release-checklist.md) records the checks run before release.

<p align="right">(<a href="#top">back to top</a>)</p>

## Documentation

| Question                       | Answer lives in                             |
| ------------------------------ | ------------------------------------------- |
| What must be true to be done   | The GitHub Issue's `## Acceptance criteria` |
| How the pieces fit together    | [design.md](./docs/design.md)               |
| What the API promises          | [api-design.md](./docs/api-design.md)       |
| What the interface must do     | [ui-design.md](./docs/ui-design.md)         |
| How to deploy and roll back    | [deployment.md](./docs/deployment.md)       |
| How to work in this repository | [CLAUDE.md](./CLAUDE.md)                    |

There is no `docs/ACCEPTANCE.md` and no `docs/PRD.md`. The same criteria written in two places means one of them is out of date, and nothing says which.

<p align="right">(<a href="#top">back to top</a>)</p>

## Troubleshooting

### Every generation fails locally, and the browser blocks the response from `http://localhost:8787/api/random` for CORS

The Worker authorizes only the origins in `ALLOWED_ORIGINS`, and `wrangler dev` reads them from `apps/web/backend/.dev.vars`. Without that file the allowlist is empty, so the browser cannot read any response. Create it from the example and restart `bun run dev:api`.

```bash
cp apps/web/backend/.dev.vars.example apps/web/backend/.dev.vars
```

### `wrangler dev` and every backend test fail to start after `compatibility_date` was changed

`compatibility_date` in `apps/web/backend/wrangler.jsonc` must not be newer than the date the bundled workerd supports. Set it back to a date no later than that one, or update `wrangler` together with it.

```bash
git diff -- apps/web/backend/wrangler.jsonc
```

### A Worker deployed with `wrangler deploy` refuses every browser origin

The backend's `deploy` script in `apps/web/backend` is a plain `wrangler deploy`. It sets no `ALLOWED_ORIGINS`, and `wrangler.jsonc` deliberately carries none. Deploy through the workflow, which passes the Pages origin as `ALLOWED_ORIGINS`.

```bash
gh workflow run deploy.yml -f target=backend
```

### `libevent-2.1.so.7: cannot open shared object file` when WebKit starts on Linux

Playwright's WebKit needs system libraries that the browser download does not include. Install them for the browsers you run.

```bash
cd apps/web/frontend
bunx playwright install-deps webkit
```

<p align="right">(<a href="#top">back to top</a>)</p>
