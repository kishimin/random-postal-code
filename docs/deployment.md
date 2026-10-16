# Deployment and Rollback

How the Zipnami Web MVP reaches production and how to undo a release. The
frontend (`apps/web/frontend`) is a static Cloudflare Pages site, and the
API (`apps/web/backend`) is a separate Cloudflare Worker (design.md section
10). They deploy and roll back independently, and each through its own
GitHub Actions workflow:

| Workflow                         | What it does                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`   | Verifies settings, deploys the Worker and/or the Pages site, then runs the smoke check |
| `.github/workflows/rollback.yml` | Restores an earlier Worker version or an earlier Pages deployment                      |

Both run only when started by hand (`workflow_dispatch`), and both share
one concurrency group, so a deploy and a rollback never overlap.

## One-time setup

Nothing below exists until someone with access to the Cloudflare account
creates it. The workflows read every production value from the
`production` GitHub Environment, so none of them are committed.

1. Create the Pages project as a Direct Upload project whose production
   branch is `main`. The deploy workflow uploads with `--branch main`, and
   only the production branch counts as a production deployment:

   ```sh
   bunx wrangler pages project create <project> --production-branch main
   ```

   Its production origin is `https://<project>.pages.dev`.

2. Create a Cloudflare API token with **Account › Workers Scripts › Edit**
   and **Account › Cloudflare Pages › Edit** for the account.

3. Deploy the Worker once (the first run of `deploy.yml` with target
   `backend` does it) and note its URL:
   `https://zipnami-api.<workers-subdomain>.workers.dev`.

4. In the repository, create a GitHub Environment named `production` and
   set:

   | Kind     | Name                        | Value                                                       |
   | -------- | --------------------------- | ----------------------------------------------------------- |
   | Secret   | `CLOUDFLARE_API_TOKEN`      | The token from step 2                                       |
   | Secret   | `CLOUDFLARE_ACCOUNT_ID`     | The Cloudflare account ID                                   |
   | Variable | `ZIPNAMI_PAGES_PROJECT`     | `<project>` from step 1                                     |
   | Variable | `ZIPNAMI_PAGES_ORIGIN`      | `https://<project>.pages.dev`, no trailing slash            |
   | Variable | `ZIPNAMI_WORKER_URL`        | The Worker URL from step 3                                  |
   | Variable | `ZIPNAMI_ADSENSE_CLIENT_ID` | The production AdSense publisher ID (`ca-pub-` + 16 digits) |
   | Variable | `ZIPNAMI_ADSENSE_SLOT_ID`   | The production ad unit's numeric slot ID                    |

`ZIPNAMI_PAGES_ORIGIN` is used twice on purpose: it becomes the Worker's
CORS allowlist (`ALLOWED_ORIGINS`), and it is the site the smoke check
visits. The two can't drift apart.

## Deploying

```sh
gh workflow run deploy.yml -f target=both
```

`target` is `both`, `backend`, or `frontend`. For each half it chose, the
workflow:

1. **Verifies the settings** before anything is deployed, and fails the job
   if one is unusable. It names the setting at fault but never prints a
   value.
   - Worker (`bun run --filter @zipnami/web-backend verify:deploy-env`):
     `ALLOWED_ORIGINS` must be exactly one `https` origin. A wildcard, plain
     `http`, a path, or a trailing slash is refused, because the CORS
     middleware would silently match nothing.
   - Pages (`bun run --filter @zipnami/web-frontend verify:deploy-env`):
     `VITE_API_BASE_URL` must be the Worker's `https` URL. The AdSense IDs
     must be real rather than the development placeholders. Test ads must be
     off (`VITE_ADSENSE_TEST_MODE=false`). Maps settings are not checked
     yet, because the Maps integration (Issue #8) has not merged.
2. **Deploys.**
   - Worker: `bunx wrangler deploy --var ALLOWED_ORIGINS:$PAGES_ORIGIN`.
   - Pages: builds with the Worker URL baked in, then runs
     `bunx wrangler pages deploy dist --project-name <project> --branch main`.
3. **Runs the smoke check** against `ZIPNAMI_PAGES_ORIGIN`, once both
   halves have finished (a half that wasn't chosen counts as finished):
   `bun run --filter @zipnami/web-frontend smoke:production`. It loads the
   live site, generates a postal code, requires a `200` from the Worker's
   `/api/random`, and reloads the `/privacy` deep link. Nothing is stubbed.

The smoke check also runs against any deployment, or against a local stack:

```sh
SMOKE_BASE_URL=https://<project>.pages.dev bun run --filter @zipnami/web-frontend smoke:production
```

To try it locally, run the Worker with
`bunx wrangler dev --var ALLOWED_ORIGINS:http://localhost:4173` in
`apps/web/backend`. Then build the frontend with
`VITE_API_BASE_URL=http://localhost:8787`, serve it with
`bunx vite preview --port 4173`, and point `SMOKE_BASE_URL` at
`http://localhost:4173`.

## Rolling back

Each half rolls back on its own.

### Worker

Find the version to restore:

```sh
cd apps/web/backend
bunx wrangler deployments list
```

Then run:

```sh
gh workflow run rollback.yml -f target=backend -f version=<version-id>
```

An empty `version` restores the version uploaded before the current one.
The workflow runs
`bunx wrangler rollback <version-id> --message "..."`, which immediately
makes that version the active deployment.

### Pages

Find the deployment to restore. Only an earlier successful production
deployment can be restored:

```sh
bunx wrangler pages deployment list --project-name <project> --environment production
```

Then run:

```sh
gh workflow run rollback.yml -f target=frontend -f version=<deployment-id>
```

wrangler has no Pages rollback command, so the workflow calls Cloudflare's
API:
`POST https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/<project>/deployments/<deployment-id>/rollback`.
The Cloudflare dashboard's **Rollback to this deployment** action does the
same thing.

Rolling back the Pages site doesn't change which Worker URL it calls.
Rolling back either half alone is safe only while both sides still speak
the same `GET /api/random` contract (api-design.md). If a release changed
that contract, roll back both halves.
