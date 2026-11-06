import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #108: deploy to production automatically after CI
 * passes on main.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What this test can and cannot observe
 * -------------------------------------
 * Whether GitHub actually starts the workflow, and whether Cloudflare and
 * Discord receive anything, is observed by merging, not here. This test holds
 * what the repository controls: the triggers and conditions the deploy
 * workflow declares, which commit it deploys, the rule that picks the halves
 * to deploy, and the failure report.
 *
 * The rule that picks the halves is a module, not a workflow expression, so
 * it can be exercised with changed-file lists. It is loaded inside each test:
 * while it does not exist, only the tests about it fail, each saying so.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
const planModulePath = path.join(
  repositoryRoot,
  ".github",
  "scripts",
  "plan-deploy.mjs",
);

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
  steps?: Step[];
};
type Workflow = {
  name?: string;
  on?: Record<string, unknown>;
  jobs: Record<string, Job>;
};

const readWorkflow = (name: string): Workflow =>
  Bun.YAML.parse(
    readFileSync(path.join(workflowsDirectory, name), "utf8"),
  ) as Workflow;

const deployWorkflow = (): Workflow => readWorkflow("deploy.yml");

/** The job whose steps run `pattern`. */
const jobRunning = (
  workflow: Workflow,
  pattern: RegExp,
): { id: string; job: Job; step: Step } => {
  for (const [id, job] of Object.entries(workflow.jobs)) {
    const step = (job.steps ?? []).find((candidate) =>
      pattern.test(candidate.run ?? ""),
    );
    if (step !== undefined) {
      return { id, job, step };
    }
  }
  throw new Error(`no job runs ${pattern}`);
};

const pagesDeploy = (workflow: Workflow) =>
  jobRunning(workflow, /\bwrangler\b[^\n]*\bpages deploy\b/);
const workerDeploy = (workflow: Workflow) =>
  jobRunning(workflow, /\bwrangler\b[^\n]*\bdeploy\b(?![^\n]*pages)/);
const productionTests = (workflow: Workflow) =>
  jobRunning(workflow, /\be2e:production\b/);

const needsOf = (job: Job): string[] =>
  job.needs === undefined ? [] : [job.needs].flat();

/** A job's own condition and the conditions of every job it waits for. */
const conditionsGating = (workflow: Workflow, id: string): string[] => {
  const job = workflow.jobs[id];
  return [
    job.if ?? "",
    ...needsOf(job).flatMap((need) => conditionsGating(workflow, need)),
  ];
};

/** Every value a step can see: its run script, env, and inputs. */
const stepText = (step: Step): string =>
  [
    step.run ?? "",
    ...Object.values(step.env ?? {}),
    ...Object.values(step.with ?? {}),
  ].join("\n");

type Plan = { frontend: boolean; backend: boolean };
type PlanDeploy = (facts: {
  changedFiles: string[] | null;
  previousDeploySucceeded: boolean;
}) => Plan;

const loadPlanDeploy = async (): Promise<PlanDeploy> => {
  const files = readdirSync(path.dirname(planModulePath));
  expect(
    files,
    ".github/scripts/plan-deploy.mjs, which picks the halves to deploy, does not exist",
  ).toContain(path.basename(planModulePath));

  const module = (await import(pathToFileURL(planModulePath).href)) as {
    planDeploy?: PlanDeploy;
  };
  expect(
    typeof module.planDeploy,
    "plan-deploy.mjs exports no planDeploy function",
  ).toBe("function");

  return module.planDeploy as PlanDeploy;
};

/** The section of a Markdown document under `heading`, up to the next one. */
const sectionOf = (markdown: string, heading: RegExp): string => {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  expect(start, `no heading matches ${heading}`).toBeGreaterThanOrEqual(0);
  const level = /^#+/.exec(lines[start])?.[0].length ?? 0;
  const end = lines.findIndex(
    (line, index) =>
      index > start && new RegExp(`^#{1,${level}}\\s`).test(line),
  );
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
};

describe("Issue #108: deploying to production automatically after CI passes on main", () => {
  test("the design and the runbook describe automatic deployment, its trigger, its halves, and its failure report", () => {
    const design = sectionOf(
      readFileSync(path.join(repositoryRoot, "docs", "design.md"), "utf8"),
      /^## 10\. Deployment and Operations/,
    );
    const runbook = readFileSync(
      path.join(repositoryRoot, "docs", "deployment.md"),
      "utf8",
    );

    for (const [document, text] of [
      ["design.md section 10", design],
      ["docs/deployment.md", runbook],
    ] as const) {
      expect(
        text,
        `${document} does not describe automatic deployment`,
      ).toMatch(/automatic/i);
      expect(text, `${document} does not name what triggers it`).toMatch(
        /CI \(Push\)/,
      );
      expect(
        text,
        `${document} does not say only the changed half deploys`,
      ).toMatch(/changed/i);
      expect(
        text,
        `${document} does not say failures are reported to Discord`,
      ).toMatch(/Discord/);
    }
    expect(
      runbook,
      "docs/deployment.md does not tell the owner which secret holds the Discord webhook",
    ).toContain("ZIPNAMI_DISCORD_WEBHOOK_URL");
  });

  test("deploy.yml starts when CI (Push) completes on main, and still runs by hand", () => {
    const workflow = deployWorkflow();
    const ciPushName = readWorkflow("ci-push.yml").name;
    const trigger = workflow.on?.workflow_run as
      | { workflows?: string[]; types?: string[]; branches?: string[] }
      | undefined;

    expect(trigger, "deploy.yml has no workflow_run trigger").toBeDefined();
    expect(trigger?.workflows).toEqual([ciPushName as string]);
    expect(trigger?.types).toEqual(["completed"]);
    expect(trigger?.branches).toEqual(["main"]);

    const dispatch = workflow.on?.workflow_dispatch as
      { inputs?: { target?: { options?: string[] } } } | undefined;
    expect(dispatch?.inputs?.target?.options).toEqual(
      expect.arrayContaining(["both", "backend", "frontend"]),
    );
  });

  test("an automatic deploy runs only when CI succeeded for a push to main", () => {
    const workflow = deployWorkflow();

    for (const deploy of [pagesDeploy(workflow), workerDeploy(workflow)]) {
      const gate = conditionsGating(workflow, deploy.id).join("\n");

      expect(
        gate,
        `${deploy.id} does not require the CI run to have succeeded`,
      ).toMatch(/github\.event\.workflow_run\.conclusion\s*==\s*'success'/);
      expect(
        gate,
        `${deploy.id} does not require the CI run to be a push`,
      ).toMatch(/github\.event\.workflow_run\.event\s*==\s*'push'/);
      expect(
        gate,
        `${deploy.id} does not require the CI run to be on main`,
      ).toMatch(/github\.event\.workflow_run\.head_branch\s*==\s*'main'/);
      // The manual path keeps its own guard (Issue #19).
      expect(gate).toMatch(/github\.ref\s*==\s*'refs\/heads\/main'/);
    }
  });

  test("an automatic deploy deploys the commit CI verified, not a later commit on main", () => {
    const workflow = deployWorkflow();
    const verifiedCommit = /github\.event\.workflow_run\.head_sha/;

    for (const { id, job } of [
      pagesDeploy(workflow),
      workerDeploy(workflow),
      productionTests(workflow),
    ]) {
      const checkouts = (job.steps ?? []).filter((step) =>
        /^actions\/checkout@/.test(step.uses ?? ""),
      );

      expect(checkouts.length, `${id} checks nothing out`).toBeGreaterThan(0);
      for (const checkout of checkouts) {
        expect(
          checkout.with?.ref ?? "",
          `${id} checks out the newest commit on main rather than the one CI verified`,
        ).toMatch(verifiedCommit);
      }
    }

    // Cloudflare records the commit a Pages deployment came from; it must be
    // the deployed one. $GITHUB_SHA is main's newest commit on workflow_run.
    const pages = pagesDeploy(workflow).step;
    expect(stepText(pages)).toMatch(verifiedCommit);
    expect(pages.run ?? "").not.toMatch(/\$\{?GITHUB_SHA\b/);
  });

  test("frontend-only changes deploy Pages, and backend or postal-data changes deploy the Worker", async () => {
    const planDeploy = await loadPlanDeploy();
    const plan = (changedFiles: string[]) =>
      planDeploy({ changedFiles, previousDeploySucceeded: true });

    expect(plan(["apps/web/frontend/src/app/views/RootLayout.tsx"])).toEqual({
      frontend: true,
      backend: false,
    });
    expect(plan(["apps/web/backend/src/app.ts"])).toEqual({
      frontend: false,
      backend: true,
    });
    expect(plan(["packages/postal-data/src/parse.ts"])).toEqual({
      frontend: false,
      backend: true,
    });
    expect(
      plan(["apps/web/frontend/src/main.tsx", "apps/web/backend/src/index.ts"]),
    ).toEqual({ frontend: true, backend: true });
  });

  test("documentation- or acceptance-test-only changes deploy nothing", async () => {
    const planDeploy = await loadPlanDeploy();

    expect(
      planDeploy({
        changedFiles: [
          "docs/design.md",
          "README.md",
          "acceptance/web-deployment.medium.test.ts",
          "apps/web/frontend/README.md",
        ],
        previousDeploySucceeded: true,
      }),
    ).toEqual({ frontend: false, backend: false });
    // Documentation next to a frontend change does not widen the deploy.
    expect(
      planDeploy({
        changedFiles: ["docs/ui-design.md", "apps/web/frontend/src/main.tsx"],
        previousDeploySucceeded: true,
      }),
    ).toEqual({ frontend: true, backend: false });
  });

  test("any other change deploys both halves", async () => {
    const planDeploy = await loadPlanDeploy();

    for (const changed of [
      "packages/shared/src/index.ts",
      "bun.lock",
      "package.json",
      ".github/actions/setup-frontend/action.yml",
      ".github/workflows/deploy.yml",
    ]) {
      expect(
        planDeploy({ changedFiles: [changed], previousDeploySucceeded: true }),
        `${changed} should deploy both halves`,
      ).toEqual({ frontend: true, backend: true });
    }
  });

  test("both halves deploy when the previous deploy did not succeed or the last verified commit is unknown", async () => {
    const planDeploy = await loadPlanDeploy();

    expect(
      planDeploy({
        changedFiles: ["docs/design.md"],
        previousDeploySucceeded: false,
      }),
    ).toEqual({ frontend: true, backend: true });
    expect(
      planDeploy({ changedFiles: null, previousDeploySucceeded: true }),
    ).toEqual({ frontend: true, backend: true });
  });

  test("the production tests run after an automatic deploy, and not when nothing was deployed", () => {
    const workflow = deployWorkflow();
    const tests = productionTests(workflow);
    const pages = pagesDeploy(workflow);
    const worker = workerDeploy(workflow);

    expect(needsOf(tests.job)).toEqual(
      expect.arrayContaining([pages.id, worker.id]),
    );
    const condition = tests.job.if ?? "";
    expect(
      condition,
      "the production tests do not require that the Pages job deployed",
    ).toMatch(new RegExp(`needs\\.${pages.id}\\.result\\s*==\\s*'success'`));
    expect(
      condition,
      "the production tests do not require that the Worker job deployed",
    ).toMatch(new RegExp(`needs\\.${worker.id}\\.result\\s*==\\s*'success'`));
  });

  test("a failed deploy or failed production tests post the run and the rollback command to Discord, without printing the webhook", () => {
    const workflow = deployWorkflow();
    const watched = [
      pagesDeploy(workflow).id,
      workerDeploy(workflow).id,
      productionTests(workflow).id,
    ];
    const reporters = Object.entries(workflow.jobs).filter(([, job]) =>
      (job.steps ?? []).some((step) =>
        Object.values(step.env ?? {}).some((value) =>
          /\bsecrets\.ZIPNAMI_DISCORD_WEBHOOK_URL\b/.test(value),
        ),
      ),
    );

    expect(
      reporters.map(([id]) => id),
      "no job posts to the ZIPNAMI_DISCORD_WEBHOOK_URL webhook",
    ).toHaveLength(1);
    const [, reporter] = reporters[0];

    // It reports failures only: a successful run posts nothing.
    expect(reporter.if ?? "").toMatch(/\bfailure\(\)/);
    expect(reporter.if ?? "").not.toMatch(/\balways\(\)|\bsuccess\(\)/);
    expect(needsOf(reporter)).toEqual(expect.arrayContaining(watched));

    const message = (reporter.steps ?? []).map(stepText).join("\n");
    expect(message, "the message does not link the failed run").toMatch(
      /actions\/runs\/\$\{\{\s*github\.run_id\s*\}\}|\$\{?GITHUB_RUN_ID\b/,
    );
    expect(message, "the message does not name the rollback command").toMatch(
      /gh workflow run rollback\.yml/,
    );
    // The webhook reaches the step through env only, and is never echoed.
    const scripts = (reporter.steps ?? [])
      .map((step) => step.run ?? "")
      .join("\n");
    expect(scripts).not.toMatch(/secrets\./);
    expect(scripts).not.toMatch(/\bset -x\b|\becho\b[^\n]*WEBHOOK/);
  });

  test("nothing rolls back automatically", () => {
    const workflow = deployWorkflow();

    // The failure report may name the rollback command in its message (env),
    // but no step runs one.
    for (const [id, job] of Object.entries(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        expect(step.run ?? "", `${id} runs a rollback`).not.toMatch(
          /\bgh workflow run\b|\bwrangler\b[^\n]*\brollback\b|\/rollback\b/,
        );
      }
    }
  });

  test("pull-request code still cannot reach the production credentials", () => {
    const workflow = deployWorkflow();
    const triggers = Object.keys(workflow.on ?? {});

    expect(triggers.sort()).toEqual(["workflow_dispatch", "workflow_run"]);

    // workflow_run runs with the repository's secrets, so the workflow it
    // follows must itself run only for pushes to main.
    const ciPush = readWorkflow("ci-push.yml");
    expect(Object.keys(ciPush.on ?? {})).toEqual(["push"]);
    expect(
      (ciPush.on?.push as { branches?: string[] } | undefined)?.branches,
    ).toEqual(["main"]);
  });
});
