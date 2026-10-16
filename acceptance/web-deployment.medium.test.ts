import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #19: Deploy the frontend to Pages and the API to
 * Workers.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What this test can and cannot observe
 * -------------------------------------
 * Three criteria are about the production Cloudflare account itself: assets
 * actually deployed to the Pages project, the Worker actually deployed, and
 * a smoke check actually run against production. The repository has no
 * Cloudflare credentials, and by the user's instruction on Issue #19
 * (2026-10-14) everything that does not need them is completed first. So
 * this test holds what the repository controls: that the deployment
 * automation wires the right values to the right places, verifies its
 * settings without printing them, keeps the two halves independently
 * deployable and reversible, runs a smoke check against production after
 * deploying, and is documented with commands that exist. Whether the
 * production run succeeded is observed by running the workflow, not here.
 *
 * Which values are configuration
 * ------------------------------
 * design.md section 12 leaves the production Pages origin, Worker URL, and
 * project names to be fixed "from the provisioned Cloudflare resources". None
 * are provisioned yet, so the workflow must read them from repository
 * configuration (a `vars.` or `secrets.` expression) rather than hard-code a
 * guess. The test pins that, not the values.
 *
 * Direct navigation and refresh (the SPA criterion) are already held by
 * config-contracts.test.mjs ("Pages serves index.html for a path no file
 * matches"); the smoke check additionally exercises them in production.
 *
 * Out of scope: a custom domain and multi-region backends.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");

type Step = {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};
type Job = {
  needs?: string | string[];
  if?: string;
  environment?: unknown;
  steps?: Step[];
};
type Workflow = { on?: unknown; jobs: Record<string, Job> };

const readWorkflow = (name: string): Workflow =>
  Bun.YAML.parse(
    readFileSync(path.join(workflowsDirectory, name), "utf8"),
  ) as Workflow;

const workflowNames = (): string[] =>
  readdirSync(workflowsDirectory).filter((name) => /\.ya?ml$/.test(name));

/** The single workflow whose jobs deploy, found by what it runs. */
const findWorkflowRunning = (
  pattern: RegExp,
): { name: string; workflow: Workflow } => {
  const matches = workflowNames()
    .map((name) => ({ name, workflow: readWorkflow(name) }))
    .filter(({ workflow }) =>
      Object.values(workflow.jobs).some((job) =>
        (job.steps ?? []).some((step) => pattern.test(step.run ?? "")),
      ),
    );

  expect(matches.map(({ name }) => name)).toHaveLength(1);

  return matches[0];
};

const deployment = () => findWorkflowRunning(/\bwrangler\b[^\n]*\bdeploy\b/);
const rollback = () => findWorkflowRunning(/\bwrangler\b[^\n]*\brollback\b/);

/** The job whose steps run `pattern`, and that step. */
const jobRunning = (
  workflow: Workflow,
  pattern: RegExp,
): { id: string; job: Job; step: Step; index: number } => {
  for (const [id, job] of Object.entries(workflow.jobs)) {
    const index = (job.steps ?? []).findIndex((step) =>
      pattern.test(step.run ?? ""),
    );
    if (index >= 0) {
      return { id, job, step: (job.steps ?? [])[index], index };
    }
  }
  throw new Error(`no job runs ${pattern}`);
};

const needsOf = (job: Job): string[] =>
  job.needs === undefined ? [] : [job.needs].flat();

/** A `${{ vars.X }}` or `${{ secrets.X }}` expression, captured as `vars.X`. */
const configurationReference = (
  value: string | undefined,
): string | undefined =>
  /\$\{\{\s*((?:vars|secrets)\.\w+)\s*\}\}/.exec(value ?? "")?.[1];

/** Every value a step can see: its own env, its job's, and the workflow's. */
const stepText = (step: Step): string =>
  [
    step.run ?? "",
    ...Object.values(step.env ?? {}),
    ...Object.values(step.with ?? {}),
  ].join("\n");

const run = (
  args: string[],
  env: Record<string, string | undefined>,
): { status: number | null; output: string } => {
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(VITE_|ALLOWED_ORIGINS$|CLOUDFLARE_)/.test(key),
    ),
  );
  const result = spawnSync("bun", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...cleanEnv, ...env },
    timeout: 60_000,
  });

  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
};

const validFrontendSettings = {
  VITE_API_BASE_URL: "https://zipnami-api.example-subdomain.workers.dev",
  VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  VITE_GOOGLE_ADSENSE_SLOT_ID: "9876543210",
  VITE_ADSENSE_TEST_MODE: "false",
};

const verifyFrontend = (env: Record<string, string | undefined>) =>
  run(["run", "--filter", "@zipnami/web-frontend", "verify:deploy-env"], env);

const verifyBackend = (env: Record<string, string | undefined>) =>
  run(["run", "--filter", "@zipnami/web-backend", "verify:deploy-env"], env);

describe("Issue #19: deploying the frontend to Pages and the API to Workers", () => {
  test("Pages receives the production Worker URL through VITE_API_BASE_URL at build time", () => {
    const { workflow } = deployment();
    const pages = jobRunning(workflow, /\bwrangler\b[^\n]*\bpages deploy\b/);
    const build = (pages.job.steps ?? []).find(
      (step, index) => index < pages.index && /\bbuild\b/.test(step.run ?? ""),
    );

    expect(build, "the Pages job deploys without building first").toBeDefined();
    expect(configurationReference(build?.env?.VITE_API_BASE_URL)).toBeDefined();
  });

  test("the Worker CORS allowlist is set to the exact production Pages origin the smoke check uses", () => {
    const { workflow } = deployment();
    const worker = jobRunning(
      workflow,
      /\bwrangler\b[^\n]*\bdeploy\b(?![^\n]*pages)/,
    );
    const smoke = jobRunning(workflow, /\bsmoke\b/);

    expect(stepText(worker.step)).toMatch(/--var\s+ALLOWED_ORIGINS:/);

    // The same configuration value names the origin the Worker allows and
    // the site the smoke check visits, so the two cannot drift apart.
    const referencesIn = (step: Step) =>
      new Set(
        [...stepText(step).matchAll(/\b(?:vars|secrets)\.\w+/g)].map(
          ([reference]) => reference,
        ),
      );
    const shared = [...referencesIn(worker.step)].filter((reference) =>
      referencesIn(smoke.step).has(reference),
    );

    expect(shared).not.toEqual([]);
  });

  test("the Worker refuses to deploy with an allowlist that is not exactly one https origin", () => {
    for (const unusable of [
      undefined,
      "",
      "*",
      "http://zipnami.pages.dev",
      "https://zipnami.pages.dev/",
      "https://zipnami.pages.dev/app",
      "https://*.pages.dev",
    ]) {
      const result = verifyBackend({ ALLOWED_ORIGINS: unusable });

      expect({ unusable, status: result.status }).not.toEqual({
        unusable,
        status: 0,
      });
      expect(result.output).toContain("ALLOWED_ORIGINS");
    }

    expect(
      verifyBackend({ ALLOWED_ORIGINS: "https://zipnami.pages.dev" }).status,
    ).toBe(0);
  });

  test("frontend and backend can be deployed independently", () => {
    const { workflow } = deployment();
    const pages = jobRunning(workflow, /\bwrangler\b[^\n]*\bpages deploy\b/);
    const worker = jobRunning(
      workflow,
      /\bwrangler\b[^\n]*\bdeploy\b(?![^\n]*pages)/,
    );

    expect(pages.id).not.toBe(worker.id);
    // Neither half waits for the other to deploy.
    expect(needsOf(pages.job)).not.toContain(worker.id);
    expect(needsOf(worker.job)).not.toContain(pages.id);
    // Each can be chosen on its own.
    expect(pages.job.if ?? "").toMatch(/frontend/);
    expect(worker.job.if ?? "").toMatch(/backend/);
  });

  test("frontend and backend can be rolled back independently", () => {
    const { workflow } = rollback();
    const worker = jobRunning(workflow, /\bwrangler\b[^\n]*\brollback\b/);
    // wrangler has no Pages rollback command; Cloudflare's API does.
    const pages = jobRunning(
      workflow,
      /pages\/projects\/[^\s]+\/deployments\/[^\s]+\/rollback/,
    );

    expect(pages.id).not.toBe(worker.id);
    expect(needsOf(pages.job)).not.toContain(worker.id);
    expect(needsOf(worker.job)).not.toContain(pages.id);
    expect(pages.job.if ?? "").toMatch(/frontend/);
    expect(worker.job.if ?? "").toMatch(/backend/);
  });

  test("deployment verifies the advertising settings before deploying, without printing them", () => {
    for (const [name, unusable] of [
      ["VITE_GOOGLE_ADSENSE_CLIENT_ID", undefined],
      ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-0000000000000000"],
      ["VITE_GOOGLE_ADSENSE_SLOT_ID", undefined],
      ["VITE_GOOGLE_ADSENSE_SLOT_ID", "0000000000"],
      ["VITE_ADSENSE_TEST_MODE", "true"],
      ["VITE_API_BASE_URL", "http://zipnami-api.example-subdomain.workers.dev"],
    ] as const) {
      const result = verifyFrontend({
        ...validFrontendSettings,
        [name]: unusable,
      });

      expect({ name, unusable, status: result.status }).not.toEqual({
        name,
        unusable,
        status: 0,
      });
      expect(result.output).toContain(name);
    }

    const accepted = verifyFrontend(validFrontendSettings);

    expect(accepted.status).toBe(0);
    // Not even the accepted values are echoed: a log is not the place to
    // learn what a production setting is.
    for (const value of Object.values(validFrontendSettings)) {
      if (value.length > 5) {
        expect(accepted.output).not.toContain(value);
      }
    }
    expect(
      verifyFrontend({
        ...validFrontendSettings,
        VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-0000000000000000",
      }).output,
    ).not.toContain("ca-pub-0000000000000000");

    // The deployment runs both verifications before its deploy steps.
    const { workflow } = deployment();
    const pages = jobRunning(workflow, /\bwrangler\b[^\n]*\bpages deploy\b/);
    const worker = jobRunning(
      workflow,
      /\bwrangler\b[^\n]*\bdeploy\b(?![^\n]*pages)/,
    );

    for (const deploy of [pages, worker]) {
      const verifiedFirst = (deploy.job.steps ?? [])
        .slice(0, deploy.index)
        .some((step) => /verify:deploy-env/.test(step.run ?? ""));

      expect({ job: deploy.id, verifiedFirst }).toEqual({
        job: deploy.id,
        verifiedFirst: true,
      });
    }
  });

  test("a smoke check against production runs after deploying", () => {
    const { workflow } = deployment();
    const smoke = jobRunning(workflow, /\bsmoke\b/);
    const pages = jobRunning(workflow, /\bwrangler\b[^\n]*\bpages deploy\b/);
    const worker = jobRunning(
      workflow,
      /\bwrangler\b[^\n]*\bdeploy\b(?![^\n]*pages)/,
    );

    expect(needsOf(smoke.job)).toEqual(
      expect.arrayContaining([pages.id, worker.id]),
    );
    // The smoke check is a command the repository defines, not inline shell.
    const script = /bun run (?:--filter\s+\S+\s+)?([\w:-]*smoke[\w:-]*)/.exec(
      smoke.step.run ?? "",
    )?.[1];

    expect(script).toBeDefined();
    const scripts = ["apps/web/frontend", "apps/web/backend", "."].flatMap(
      (directory) =>
        Object.keys(
          (
            JSON.parse(
              readFileSync(
                path.join(repositoryRoot, directory, "package.json"),
                "utf8",
              ),
            ) as { scripts?: Record<string, string> }
          ).scripts ?? {},
        ),
    );

    expect(scripts).toContain(script as string);
  });

  test("deployment and rollback commands are documented", () => {
    const documents = ["docs", "apps/web/frontend", "apps/web/backend", "."]
      .flatMap((directory) =>
        readdirSync(path.join(repositoryRoot, directory))
          .filter((name) => name.endsWith(".md"))
          .map((name) => path.join(repositoryRoot, directory, name)),
      )
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(documents).toContain(deployment().name);
    expect(documents).toContain(rollback().name);
    expect(documents).toMatch(/wrangler rollback/);
    expect(documents).toMatch(/deployments\/[^\s]*\/rollback/);
  });
});
