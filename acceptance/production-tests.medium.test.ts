import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #104: Test the production happy path as a Large
 * journey, without real ad or Analytics traffic.
 *
 * Each test name states the acceptance criterion it holds.
 *
 * What this test can and cannot observe
 * -------------------------------------
 * The journey itself runs against the deployed site, which only the Deploy
 * workflow can reach. So this file holds what the repository controls: where
 * the production tests live and how they are named, that the script really
 * selects them, that the workflow runs them after a deploy and is gated by
 * them, that the CSP header check is gone, and that the commands are
 * documented. That the blocked hosts are blocked is a browser behaviour, held
 * by production-tests-third-party-block.medium.test.ts. Whether the journey
 * passed on production is observed by running the workflow, not here.
 *
 * It reads repository files and starts Playwright to list tests (no browser
 * is launched), which makes it Medium (ADR-0004), and it runs under
 * `bun test` from the repository root like web-deployment.medium.test.ts.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendRoot = path.join(repositoryRoot, "apps", "web", "frontend");
const productionTestDirectory = path.join(frontendRoot, "e2e", "production");
const deployWorkflowPath = path.join(
  repositoryRoot,
  ".github",
  "workflows",
  "deploy.yml",
);

// The name the Issue fixes for the command, and the configuration it runs.
const productionScript = "e2e:production";
const productionConfig = "playwright.production.config.ts";

// The GitHub Environment variable naming the deployed Pages site (deploy.yml).
const pagesOriginReference = "vars.ZIPNAMI_PAGES_ORIGIN";

type Step = {
  name?: string;
  run?: string;
  env?: Record<string, string>;
  "continue-on-error"?: unknown;
};
type Job = {
  name?: string;
  needs?: string | string[];
  "continue-on-error"?: unknown;
  steps?: Step[];
};
type Workflow = { jobs: Record<string, Job> };

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

const readWorkflow = (file: string): Workflow =>
  Bun.YAML.parse(readFileSync(file, "utf8")) as Workflow;

const needsOf = (job: Job): string[] =>
  job.needs === undefined ? [] : [job.needs].flat();

/** The job and step of deploy.yml that run the production tests. */
const productionStep = () => {
  const workflow = readWorkflow(deployWorkflowPath);
  const matches = Object.entries(workflow.jobs).flatMap(([id, job]) =>
    (job.steps ?? [])
      .filter((step) =>
        new RegExp(`\\bbun run\\b[^\\n]*\\b${productionScript}\\b`).test(
          step.run ?? "",
        ),
      )
      .map((step) => ({ id, job, step })),
  );

  expect(matches).toHaveLength(1);

  return { workflow, ...matches[0] };
};

/*
 * The environment variable the workflow hands the deployed origin to the
 * tests through. Read from the workflow rather than fixed here, so this test
 * runs the command exactly as the deploy does.
 */
const baseUrlVariable = (step: Step) => {
  const entry = Object.entries(step.env ?? {}).find(([, value]) =>
    new RegExp(
      `^\\$\\{\\{\\s*${pagesOriginReference.replace(".", "\\.")}\\s*\\}\\}$`,
    ).test(value.trim()),
  );

  expect(
    entry,
    `the step passes ${pagesOriginReference} in its env`,
  ).toBeDefined();

  return (entry as [string, string])[0];
};

type ListedSuite = {
  file?: string;
  specs?: unknown[];
  suites?: ListedSuite[];
};

/** Every file a suite tree holds at least one test in. */
const filesWithTests = (suites: readonly ListedSuite[]): string[] =>
  suites.flatMap((suite) => [
    ...((suite.specs ?? []).length > 0 && suite.file !== undefined
      ? [suite.file]
      : []),
    ...filesWithTests(suite.suites ?? []),
  ]);

/**
 * The test files the production command runs, as absolute paths, found by
 * asking Playwright to list them through the package script itself.
 */
const listedProductionTestFiles = () => {
  const { step } = productionStep();
  const result = spawnSync(
    "bun",
    ["run", productionScript, "--list", "--reporter=json"],
    {
      cwd: frontendRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        [baseUrlVariable(step)]: "https://zipnami-production.example.com",
      },
      timeout: 120_000,
    },
  );

  expect({ status: result.status, stderr: result.stderr }).toEqual({
    status: 0,
    stderr: expect.any(String),
  });

  const report = JSON.parse(
    result.stdout.slice(result.stdout.indexOf("{")),
  ) as { config: { rootDir: string }; suites: ListedSuite[] };

  return [...new Set(filesWithTests(report.suites))].map((file) =>
    path.resolve(report.config.rootDir, file),
  );
};

const scriptsOf = (directory: string): Record<string, string> =>
  readJson<{ scripts?: Record<string, string> }>(
    path.join(repositoryRoot, directory, "package.json"),
  ).scripts ?? {};

const workspaceDirectories = [
  ".",
  "apps/web/frontend",
  "apps/web/backend",
  "packages/shared",
  "packages/postal-data",
];

const trackedFiles = () => {
  const result = spawnSync("git", ["ls-files"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  expect(result.status).toBe(0);

  return result.stdout.split("\n").filter((line) => line !== "");
};

const productionTestSources = () =>
  readdirSync(productionTestDirectory)
    .filter((name) => /\.test\.ts$/.test(name))
    .map((name) => ({
      name,
      source: readFileSync(path.join(productionTestDirectory, name), "utf8"),
    }));

const readDocument = (...segments: string[]) =>
  readFileSync(path.join(repositoryRoot, ...segments), "utf8");

/** Text with line breaks and runs of spaces folded, so a wrapped sentence reads as one. */
const flatten = (text: string) => text.replace(/\s+/g, " ");

describe("Issue #104: the production happy path as a Large journey", () => {
  test("the production tests live in e2e/production as *.large.test.ts files, run by playwright.production.config.ts through e2e:production", () => {
    expect(scriptsOf("apps/web/frontend")[productionScript]).toMatch(
      new RegExp(
        `\\bplaywright test\\b.*--config\\s+${productionConfig.replace(/\./g, "\\.")}\\b`,
      ),
    );

    const listed = listedProductionTestFiles();

    expect(listed.length).toBeGreaterThan(0);
    for (const file of listed) {
      expect({
        file,
        inProductionDirectory: path.dirname(file) === productionTestDirectory,
        large: file.endsWith(".large.test.ts"),
      }).toEqual({ file, inProductionDirectory: true, large: true });
    }

    // And every test file kept there is one the command runs, so none sits
    // in the directory under another size or outside the runner.
    const kept = productionTestSources().map(({ name }) =>
      path.join(productionTestDirectory, name),
    );

    expect(kept.toSorted()).toEqual(listed.toSorted());
  }, 180_000);

  test('no file, script, config, or workflow step keeps the name "smoke"', () => {
    const smoke = /smoke/i;

    expect(trackedFiles().filter((file) => smoke.test(file))).toEqual([]);

    for (const directory of workspaceDirectories) {
      expect({
        directory,
        scripts: Object.keys(scriptsOf(directory)).filter((name) =>
          smoke.test(name),
        ),
      }).toEqual({ directory, scripts: [] });
    }

    const workflowsDirectory = path.join(
      repositoryRoot,
      ".github",
      "workflows",
    );
    for (const file of readdirSync(workflowsDirectory).filter((name) =>
      /\.ya?ml$/.test(name),
    )) {
      const workflow = readWorkflow(path.join(workflowsDirectory, file));
      const names = Object.entries(workflow.jobs).flatMap(([id, job]) => [
        id,
        job.name ?? "",
        ...(job.steps ?? []).flatMap((step) => [
          step.name ?? "",
          step.run ?? "",
          ...Object.keys(step.env ?? {}),
        ]),
      ]);

      expect({ file, names: names.filter((name) => smoke.test(name)) }).toEqual(
        { file, names: [] },
      );
    }
  });

  test("deploy.yml runs e2e:production against ZIPNAMI_PAGES_ORIGIN after a deploy, and it gates the run", () => {
    const { workflow, id, job, step } = productionStep();
    const deployJobs = Object.entries(workflow.jobs)
      .filter(([, candidate]) =>
        (candidate.steps ?? []).some((each) =>
          /\bwrangler\b[^\n]*\bdeploy\b/.test(each.run ?? ""),
        ),
      )
      .map(([jobId]) => jobId);

    // Both halves deploy before it: the Worker and the Pages site.
    expect(deployJobs).toHaveLength(2);
    expect(needsOf(job)).toEqual(expect.arrayContaining(deployJobs));
    expect(deployJobs).not.toContain(id);

    baseUrlVariable(step);

    // A failure fails the run: neither the job nor the step is allowed to
    // fail quietly.
    expect(job["continue-on-error"] ?? false).toBe(false);
    expect(step["continue-on-error"] ?? false).toBe(false);
  });

  test("every production test takes its browser from the fixture that blocks advertising, consent, and Analytics", () => {
    const sources = productionTestSources();

    expect(sources.length).toBeGreaterThan(0);
    for (const { name, source } of sources) {
      expect({
        name,
        usesBlockingFixture: /from\s+["']\.\/fixtures(?:\.ts)?["']/.test(
          source,
        ),
        importsPlaywrightTestDirectly: /from\s+["']@playwright\/test["']/.test(
          source,
        ),
      }).toEqual({
        name,
        usesBlockingFixture: true,
        importsPlaywrightTestDirectly: false,
      });
    }
  });

  test("the CSP header check is removed, and docs/deployment.md says it returns when the policy is enforced", () => {
    for (const { name, source } of productionTestSources()) {
      expect({
        name,
        checksPolicyHeader: /content-security-policy/i.test(source),
      }).toEqual({ name, checksPolicyHeader: false });
    }

    const sentences = flatten(readDocument("docs", "deployment.md")).split(
      /(?<=[.!?])\s/,
    );

    expect(
      sentences.some(
        (sentence) =>
          /\b(?:CSP|Content-Security-Policy)\b/i.test(sentence) &&
          /\benforc/i.test(sentence) &&
          /#38\b/.test(sentence),
      ),
    ).toBe(true);
  });

  test("docs/deployment.md and the README describe the renamed command and what it covers", () => {
    const deployment = flatten(readDocument("docs", "deployment.md"));
    const readme = flatten(readDocument("README.md"));

    for (const [name, text] of [
      ["docs/deployment.md", deployment],
      ["README.md", readme],
    ] as const) {
      expect({ name, names: text.includes(productionScript) }).toEqual({
        name,
        names: true,
      });
      expect({ name, oldCommand: /smoke:production/.test(text) }).toEqual({
        name,
        oldCommand: false,
      });
    }

    // What the journey covers, one word each, so the wording stays the
    // document's to choose.
    for (const [part, pattern] of [
      ["generation", /\bgenerat/i],
      ["map", /\bmap\b/i],
      ["Google Maps link", /Google Maps link/i],
      ["copy", /\bcop(?:y|ies|ying)\b/i],
      ["history after reload", /\bhistory\b[^.]*\breload/i],
      ["privacy", /\/privacy\b/],
      ["blocked hosts", /\b(?:AdSense|advertising)\b[^.]*\bAnalytics\b/i],
    ] as const) {
      expect({ part, described: pattern.test(deployment) }).toEqual({
        part,
        described: true,
      });
    }
  });
});
