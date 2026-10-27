import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #58's last criterion: "Once #8 has merged, a
 * production deploy with missing or placeholder Maps settings is refused
 * before building, naming each setting without printing its value."
 *
 * #8 merged in PR #81, and its build reads one Maps setting,
 * VITE_GOOGLE_MAPS_API_KEY. Without it the site still works but every map
 * falls back to the external link (design.md section 7 isolates Maps), so a
 * production deploy without a real key would ship degraded with nothing
 * failing. The refusal is observed the way Issue #19's deployment test
 * observes it: by running the frontend's `verify:deploy-env` with the
 * settings the deploy would bake in, and by reading the deploy workflow to
 * see that this verification runs, with the same value, before the build.
 *
 * What counts as a placeholder
 * ----------------------------
 * No contract defines a Maps key format, so this test does not pin one. It
 * holds the values the repository itself uses in place of a real key: the
 * empty string (.env.example, the Vitest env), CI's
 * `ci-placeholder-maps-key`, and the Large E2E run's
 * `large-test-placeholder-maps-key`. A production deploy carrying any of them
 * would ship a map that cannot load.
 *
 * The accepted case is held by web-deployment.medium.test.ts, whose valid
 * settings include a well-formed dummy key (approved on Issue #58).
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");

const MAPS_KEY = "VITE_GOOGLE_MAPS_API_KEY";

type Step = {
  name?: string;
  run?: string;
  env?: Record<string, string>;
};
type Job = { steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };

const run = (
  args: string[],
  env: Record<string, string | undefined>,
): { status: number; output: string } => {
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

  // A subprocess that did not finish has refused nothing.
  if (result.status === null) {
    throw new Error(
      `bun ${args.join(" ")} did not finish: ${String(result.error)}`,
    );
  }

  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
};

// Each test that runs the verifier starts several bun processes in a row,
// well past bun's 5 s default.
const SUBPROCESS_TEST_TIMEOUT_MS = 180_000;

// Every setting other than the Maps key is usable, so a refusal can only be
// about the Maps key.
const usableOtherSettings = {
  VITE_API_BASE_URL: "https://zipnami-api.example-subdomain.workers.dev",
  VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  VITE_GOOGLE_ADSENSE_SLOT_ID: "9876543210",
  VITE_ADSENSE_TEST_MODE: "false",
};

const verifyFrontend = (env: Record<string, string | undefined>) =>
  run(["run", "--filter", "@zipnami/web-frontend", "verify:deploy-env"], env);

/** The single job that deploys Pages, found by what it runs. */
const pagesDeployJob = (): Job => {
  const jobs = readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map(
      (name) =>
        Bun.YAML.parse(
          readFileSync(path.join(workflowsDirectory, name), "utf8"),
        ) as Workflow,
    )
    .flatMap((workflow) => Object.values(workflow.jobs))
    .filter((job) =>
      (job.steps ?? []).some((step) =>
        /\bwrangler\b[^\n]*\bpages deploy\b/.test(step.run ?? ""),
      ),
    );

  expect(jobs).toHaveLength(1);

  return jobs[0];
};

describe("Issue #58: a production deploy refuses unusable Maps settings", () => {
  test(
    "a production deploy without a Maps key is refused, naming the setting",
    () => {
      for (const missing of [undefined, "", "   "]) {
        const result = verifyFrontend({
          ...usableOtherSettings,
          [MAPS_KEY]: missing,
        });

        expect({ missing, status: result.status }).not.toEqual({
          missing,
          status: 0,
        });
        expect(result.output).toContain(MAPS_KEY);
      }
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  test(
    "a production deploy with a placeholder Maps key is refused, naming the setting without printing the value",
    () => {
      for (const placeholder of [
        "ci-placeholder-maps-key",
        "large-test-placeholder-maps-key",
      ]) {
        const result = verifyFrontend({
          ...usableOtherSettings,
          [MAPS_KEY]: placeholder,
        });

        expect({ placeholder, status: result.status }).not.toEqual({
          placeholder,
          status: 0,
        });
        expect(result.output).toContain(MAPS_KEY);
        expect(result.output).not.toContain(placeholder);
      }
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  test(
    "a refusal names each unusable setting, the Maps key among them",
    () => {
      const result = verifyFrontend({
        ...usableOtherSettings,
        VITE_GOOGLE_ADSENSE_CLIENT_ID: undefined,
        [MAPS_KEY]: "ci-placeholder-maps-key",
      });

      expect(result.status).not.toBe(0);
      expect(result.output).toContain(MAPS_KEY);
      expect(result.output).toContain("VITE_GOOGLE_ADSENSE_CLIENT_ID");
      expect(result.output).not.toContain("ci-placeholder-maps-key");
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  test("the Pages deploy verifies the Maps key it builds with, before building", () => {
    const steps = pagesDeployJob().steps ?? [];
    const verifyIndex = steps.findIndex((step) =>
      /verify:deploy-env/.test(step.run ?? ""),
    );
    const buildIndex = steps.findIndex(
      (step) =>
        /\bbuild\b/.test(step.run ?? "") &&
        !/verify:deploy-env/.test(step.run ?? ""),
    );

    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    // Refused before building: a failed verify step stops the job, so the
    // build never runs with an unusable key.
    expect(verifyIndex).toBeLessThan(buildIndex);

    const verified = steps[verifyIndex].env?.[MAPS_KEY];
    const built = steps[buildIndex].env?.[MAPS_KEY];

    // Read from repository configuration, not committed: a production key
    // only exists once it is provisioned (design.md section 12).
    expect(verified ?? "").toMatch(/^\$\{\{\s*(?:vars|secrets)\.\w+\s*\}\}$/);
    // The very value the build bakes in is the one verified.
    expect(built?.trim()).toBe(verified?.trim());
  });
});
