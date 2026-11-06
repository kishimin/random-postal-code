# Deployment and Rollback

How the Zipnami Web MVP reaches production and how to undo a release. The
frontend (`apps/web/frontend`) is a static Cloudflare Pages site, and the
API (`apps/web/backend`) is a separate Cloudflare Worker (design.md section
10). They deploy and roll back independently, and each through its own
GitHub Actions workflow:

| Workflow                         | What it does                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`   | Verifies settings, deploys the Worker and/or the Pages site, then runs the production tests |
| `.github/workflows/rollback.yml` | Restores an earlier Worker version or an earlier Pages deployment                           |

`deploy.yml` runs automatically after every merge (see "Automatic deploys"
below) and can also be started by hand. `rollback.yml` runs only by hand.
Their jobs run only from `main`, so code that hasn't been reviewed and
merged can't reach production. Both share one concurrency group, so a
deploy and a rollback never overlap.

## One-time setup

Nothing below exists until someone with access to the Cloudflare account
creates it. The workflows read every production value from the
`production` GitHub Environment, so none of them are committed.

1. Create the Pages project as a Direct Upload project whose production
   branch is `main`. The deploy workflow uploads with `--branch main`, and
   only the production branch counts as a production deployment. Run it
   from `apps/web/frontend`, which pins wrangler in `bun.lock` (Issue #90):

   ```sh
   bunx wrangler pages project create <project> --production-branch main --force
   ```

   `--force` keeps it a classic Pages project. Without it, wrangler now
   hands the command to "Pages as part of Workers". On 2026-11-03 that
   failed at the repository root, and from `apps/web/backend`, where
   `wrangler.jsonc` describes the API, it deployed the API as a new Worker
   named `<project>` instead of creating a Pages project. Do not run it
   inside `apps/web/backend`. Wrangler says later commands against an
   existing classic project run on Pages directly, so only creation needs
   `--force`.

   Its production origin is `https://<project>.pages.dev`. The production
   project is `zipnami` (`https://zipnami.pages.dev`), created this way on
   2026-11-03.

2. Create a Cloudflare API token with **Account › Workers Scripts › Edit**
   and **Account › Cloudflare Pages › Edit** for the account.

3. Deploy the Worker once (the first run of `deploy.yml` with target
   `backend` does it) and note its URL:
   `https://zipnami-api.<workers-subdomain>.workers.dev`.

4. In the repository, create a GitHub Environment named `production`.
   Under **Deployment branches and tags**, limit it to `main`, so the
   credentials can't be used from any other branch even if a workflow
   changes. Then set:

   | Kind     | Name                            | Value                                                                                     |
   | -------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
   | Secret   | `CLOUDFLARE_API_TOKEN`          | The token from step 2                                                                     |
   | Secret   | `CLOUDFLARE_ACCOUNT_ID`         | The Cloudflare account ID                                                                 |
   | Variable | `ZIPNAMI_PAGES_PROJECT`         | `<project>` from step 1                                                                   |
   | Variable | `ZIPNAMI_PAGES_ORIGIN`          | `https://<project>.pages.dev`, no trailing slash                                          |
   | Variable | `ZIPNAMI_WORKER_URL`            | The Worker URL from step 3                                                                |
   | Variable | `ZIPNAMI_ADSENSE_CLIENT_ID`     | The production AdSense publisher ID (`ca-pub-` + 16 digits)                               |
   | Variable | `ZIPNAMI_ADSENSE_SLOT_ID`       | The production ad unit's numeric slot ID                                                  |
   | Variable | `ZIPNAMI_WEB_MAPS_API_KEY`      | The production Google Maps browser API key (`AIza` + 35 characters)                       |
   | Variable | `ZIPNAMI_WEB_GA_MEASUREMENT_ID` | The production Google Analytics 4 measurement ID (`G-` + letters and digits), from step 6 |

A value that a future Android app would need its own copy of carries
`WEB` in its name, so the two cannot be confused: the Maps key here is a
browser key, and an Android app needs an Android key. The Analytics
measurement ID here likewise belongs to the Web data stream. AdSense (Android
uses AdMob), Pages, and the Worker are Web only and keep their names.

`ZIPNAMI_WEB_MAPS_API_KEY` is the only Web Maps key. Restrict it by HTTP referrer
to `https://<project>.pages.dev/*` and the production domain, and by API
to the Maps Embed API only. Do not add `localhost` to its referrers: local
development runs without a key, and the map shows its fallback link
instead (design.md section 7).

`ZIPNAMI_PAGES_ORIGIN` is used twice on purpose: it becomes the Worker's
CORS allowlist (`ALLOWED_ORIGINS`), and it is the site the production
tests visit. The two can't drift apart.

5. **After the first production deploy, and before the site is announced
   or linked anywhere**, set up consent (Issue #39). Google only lets a
   message be created once the site is added to AdSense and its ad code is
   live on it, and the first deploy is what puts the code live. The
   `pages.dev` URL is not promoted until release, so that window exists.
   - In AdSense, add the production site (`https://<project>.pages.dev`)
     under **Sites**, if it is not there already. Verify ownership and
     request review there. A new site stays in **Requires review** and
     serves no ads until Google approves it and its status is **Ready**.
   - Under **Privacy & messaging**, publish a message of the type
     **European regulations** for that site. This is the consent platform
     the privacy page names. Google's AdSense tag shows the message to
     visitors from the EEA, the UK, and Switzerland, and gates ad requests
     on their choice. Nothing in the code does this itself.
   - Keep the ad setting that serves personalized ads only with consent,
     and turn on **limited ads**. A visitor who declines personalization
     then gets non-personalized or limited ads rather than none.
   - Keep the floating link that lets a visitor revisit their choice; the
     privacy page tells visitors they can change it from the message.
   - Once the site is **Ready**, so that real ads are eligible to serve,
     load the production site from an EEA connection (or a VPN exit
     there). Confirm the message appears before any ad, and that declining
     still shows an ad slot filled with a non-personalized or limited ad.
     A check made while the site is still under review passes trivially,
     because no ad serves at all. This is the release review design.md
     section 12 requires, since no automated test can place a browser in a
     consent region.

6. Set up Google Analytics (Issue #92). Only production measures visits;
   development, CI, and end-to-end test builds carry no measurement ID and
   load no Analytics script.
   - In Google Analytics, create a GA4 property and add a **web data
     stream** for `https://<project>.pages.dev`. Note the stream's
     measurement ID (`G-` followed by letters and digits).
   - Set it as the `ZIPNAMI_WEB_GA_MEASUREMENT_ID` variable in the
     `production` environment (step 4). A Pages deploy without it, or with
     a value not in the `G-` format, stops at the settings check.
   - In the stream's **Enhanced measurement** settings, keep **Page views**
     on, and under its advanced settings keep **Page changes based on
     browser history events** on. The site is a single-page application
     that sends no events of its own, so this setting is the only thing
     that counts a move between screens as a page view.
   - Check, together with step 5, that the **Privacy & messaging** message
     covers Analytics consent. The code declares consent mode defaults
     (denied for the EEA, the UK, and Switzerland, granted elsewhere); the
     message is what asks the visitor.
   - After the first deploy with the ID, open the production site and
     confirm the visit appears in the property's **Realtime** report.

7. Create a Discord webhook for the channel that should hear about failed
   deploys, and set its URL as the **repository** secret
   `ZIPNAMI_DISCORD_WEBHOOK_URL` (Settings › Secrets and variables ›
   Actions). Until it is set, a failed deploy still fails its run, but the
   report job fails too, saying the secret is missing.

## Automatic deploys

When `CI (Push)` finishes successfully for a push to `main`, `deploy.yml`
starts on its own (`workflow_run`, Issue #108). This includes merges the
unattended loop makes: they pass the same CI gate.

- **What it deploys**: the commit that CI verified
  (`github.event.workflow_run.head_sha`), not whatever is newest on `main`
  by the time the deploy starts.
- **Which halves**: the "Plan deploy" job compares that commit with the
  commit of the previous successful `CI (Push)` run, and
  `.github/scripts/plan-deploy.mjs` picks the halves from the changed files:

  | Changed                                         | Deploys |
  | ----------------------------------------------- | ------- |
  | `apps/web/frontend/`                            | Pages   |
  | `apps/web/backend/`, `packages/postal-data/`    | Worker  |
  | `docs/`, `acceptance/`, any `*.md`, `LICENSE`   | nothing |
  | anything else (shared code, lockfile, workflow) | both    |

  Both halves deploy when the previous run of `deploy.yml` did not succeed
  (it failed, or a newer deploy replaced it while it waited), or when the
  previous verified commit can't be found. A change that was never deployed
  is therefore not skipped.

- **Afterwards**: the production tests run if either half deployed. A
  documentation-only merge deploys nothing and runs no production test.
- **On failure**: the "Report failure" job posts to Discord with a link to
  the run and the rollback commands below. Nothing rolls back on its own:
  look at the run first, and roll back by hand if production is broken. A
  successful run posts nothing.

## Deploying by hand

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
     off (`VITE_ADSENSE_TEST_MODE=false`). `VITE_GOOGLE_MAPS_API_KEY` must be a real
     Google Maps browser key, not empty or one of the placeholders CI and the
     Large E2E run use. Without it every map would quietly fall back to the
     external link. Until `ZIPNAMI_WEB_MAPS_API_KEY` is set in the `production`
     environment, the Pages deploy is refused at "Verify Pages deploy
     settings" before building; this also applies to environments created
     before #58. `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID` is required too, and
     must be a GA4 measurement ID (`G-` format), not a Universal Analytics
     (`UA-`) or Google Ads (`AW-`) ID; until `ZIPNAMI_WEB_GA_MEASUREMENT_ID`
     is set, the Pages deploy is refused at the same step.
2. **Deploys.**
   - Worker: `bunx wrangler deploy --var ALLOWED_ORIGINS:$PAGES_ORIGIN`.
   - Pages: builds with the Worker URL baked in, then runs
     `bunx wrangler pages deploy dist --project-name <project> --branch main`.
3. **Runs the production tests** against `ZIPNAMI_PAGES_ORIGIN`, once both
   halves have finished (a half that wasn't chosen counts as finished):
   `bun run --filter @zipnami/web-frontend e2e:production`. A failure fails
   the run.

### What the production tests cover

They are Large tests (`apps/web/frontend/e2e/production/*.large.test.ts`,
run by `playwright.production.config.ts`): real Cloudflare and real Google,
so only what needs the deployed site is here. Error paths, layout, and
accessibility stay in the Small and Medium tests (Issue #104).

- **One happy-path journey.** Generating shows the postal code and every
  address the Worker returned, from a `200` on the Worker's own origin. The
  map embeds with the production key: an embed frame, not the fallback
  link. Each address has a Google Maps link whose query is that address,
  encoded. Copying puts the seven-digit postal code on the clipboard. The
  history still lists that postal code after a reload. `/privacy` opens and
  shows the services it names and the Japan Post attribution.
- **The SPA deep link.** A direct visit to `/privacy` and a refresh of it
  both answer `200` and show the privacy page.

Every test aborts the AdSense, consent, and Google Analytics hosts in the
browser before the page loads, so a deploy requests no real ad (which
AdSense can treat as invalid traffic) and records no visit in Analytics.
Nothing else is stubbed.

The CSP header check that used to run here was removed: the policy is
report-only, so a missing header affects no visitor. The CSP check returns
once the policy is enforced (#38).

The production tests also run against any deployment, or against a local
stack:

```sh
PRODUCTION_BASE_URL=https://<project>.pages.dev bun run --filter @zipnami/web-frontend e2e:production
```

To try it locally, run the Worker with
`bunx wrangler dev --var ALLOWED_ORIGINS:http://localhost:4173` in
`apps/web/backend`. Then build the frontend with
`VITE_API_BASE_URL=http://localhost:8787`, serve it with
`bunx vite preview --port 4173`, and point `PRODUCTION_BASE_URL` at
`http://localhost:4173`. Without a Maps key the map shows its fallback
link, so the map step fails locally unless the build has one.

Deploy through the workflow, not with `bun run deploy` in
`apps/web/backend`. That script is a plain `wrangler deploy`. It sets no
`ALLOWED_ORIGINS`, and `wrangler.jsonc` deliberately carries none, so it
would ship a Worker that refuses every browser origin.

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
Anything other than a lowercase version ID (a UUID) is refused, so the input
can't add wrangler flags.
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

The deployment ID must be a lowercase UUID. It becomes part of an
authenticated API path, so anything else is refused. wrangler has no Pages
rollback command, so the workflow calls Cloudflare's API:
`POST https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/<project>/deployments/<deployment-id>/rollback`.
The Cloudflare dashboard's **Rollback to this deployment** action does the
same thing.

Rolling back the Pages site doesn't change which Worker URL it calls.
Rolling back either half alone is safe only while both sides still speak
the same `GET /api/random` contract (api-design.md). If a release changed
that contract, roll back both halves.
