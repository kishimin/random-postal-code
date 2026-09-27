import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #18: Enforce repository quality gates in CI.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What is observable for an Issue about CI
 * ----------------------------------------
 * The criteria describe the CI system rather than the application, so there is
 * no screen or API to drive. What a contributor can observe is (a) the
 * committed workflow definitions GitHub executes, and (b) the repository
 * commands those workflows invoke. This test reads (a) as data — parsed YAML,
 * not text matching — and, where a criterion is about an outcome rather than
 * about wiring, it runs (b) exactly as CI does and judges the result: the
 * coverage gate is run and its reported numbers are read, the production build
 * is run with every credential-looking variable removed, and the postal-data
 * drift check is run against both the committed artifact and a drifted one.
 *
 * Why this runs under `bun test`
 * ------------------------------
 * Parsing the workflows needs a YAML parser. Bun, the toolchain this repository
 * already pins (1.3.13 in .github/actions/setup-frontend), ships one as
 * `Bun.YAML`, so the test needs no new dependency. The test exercises no single
 * workspace package — it exercises the repository's CI — so ADR-0069's "register
 * the test in the package it exercises" has no package to point at. It is run
 * by `bun test` from the repository root, and the "every acceptance test runs"
 * criterion below requires that invocation to be registered in the pull
 * request workflow.
 *
 * Why this is Medium
 * ------------------
 * It reads the file system, runs git, and spawns local build and test
 * processes. It uses no network and no external service (ADR-0004, ADR-0044).
 * The one criterion that cannot be observed without the network — that the
 * repository's ruleset actually makes these checks block a merge — lives in
 * `ci-quality-gates.large.test.ts`.
 *
 * Mobile and Android are excluded, not forgotten
 * ----------------------------------------------
 * The Issue names "mobile tests" and "Android production builds". design.md
 * §2 and §6.3 scope Android out of the Web MVP: it is V2 work tracked by Issues
 * #12–#15 and #20, and "must not ... become acceptance criteria for the Web
 * MVP". This repository has no Android or mobile workspace (`apps/` holds only
 * `web`), so there is nothing a CI job could test or build. The same precedent
 * Issues #16 and #17 followed applies: those parts of the criteria are held by
 * the V2 Issues that will create the Android app, and this test asserts only
 * that every workspace that *does* exist is covered — so an Android workspace
 * added later is picked up by the same assertions rather than silently skipped.
 *
 * Postal-data drift
 * -----------------
 * `apps/web/backend/src/data/postal-codes.generated.json` is the generated
 * artifact the Worker serves. The criterion is met when a single repository
 * command, `bun run check:postal-data`, succeeds while the committed artifact
 * is exactly what regenerating it from committed inputs produces, fails when
 * it is not, and runs in the pull request workflow. The command name is the
 * contract; how it regenerates (and from which committed source) is the
 * implementation's choice. The check must compare without overwriting: a
 * check that rewrites the artifact and then asks git whether anything changed
 * reports "no drift" for exactly the drifted working tree this test builds.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
const pullRequestWorkflowPath = path.join(
  workflowsDirectory,
  "ci-pull-request.yml",
);
const nightlyWorkflowPath = path.join(workflowsDirectory, "ci-nightly.yml");
const generatedPostalDataPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  "backend",
  "src",
  "data",
  "postal-codes.generated.json",
);
const thisFileName = path.basename(fileURLToPath(import.meta.url));

// Running the real gates takes tens of seconds each; bun's default per-test
// timeout is five seconds.
const PROCESS_TIMEOUT_MS = 600_000;

type Step = { name?: string; run?: string; uses?: string };
type Job = {
  name?: string;
  steps?: Step[];
  strategy?: { matrix?: { include?: Record<string, string>[] } };
  permissions?: unknown;
};
type Workflow = {
  on: unknown;
  permissions?: unknown;
  env?: Record<string, string>;
  jobs: Record<string, Job>;
};

const readJson = (filePath: string): unknown =>
  JSON.parse(readFileSync(filePath, "utf8"));

const readYaml = (filePath: string): unknown =>
  Bun.YAML.parse(readFileSync(filePath, "utf8"));

const readWorkflow = (filePath: string): Workflow =>
  readYaml(filePath) as Workflow;

const workflowFiles = (): string[] =>
  readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => path.join(workflowsDirectory, name));

const rootPackage = readJson(path.join(repositoryRoot, "package.json")) as {
  workspaces: string[];
  scripts: Record<string, string>;
};

/** Every workspace package the root package.json declares, by its globs. */
const workspacePackages = (): {
  directory: string;
  name: string;
  scripts: Record<string, string>;
}[] =>
  rootPackage.workspaces.flatMap((pattern) => {
    if (!pattern.endsWith("/*")) {
      throw new Error(`Unsupported workspace pattern: ${pattern}`);
    }
    const parent = path.join(repositoryRoot, pattern.slice(0, -2));
    return readdirSync(parent)
      .map((entry) => path.join(parent, entry))
      .filter((directory) => existsSync(path.join(directory, "package.json")))
      .map((directory) => {
        const manifest = readJson(path.join(directory, "package.json")) as {
          name: string;
          scripts?: Record<string, string>;
        };
        return {
          directory,
          name: manifest.name,
          scripts: manifest.scripts ?? {},
        };
      });
  });

const substituteMatrix = (text: string, values: Record<string, string>) =>
  text.replaceAll(/\$\{\{\s*matrix\.(\w+)\s*\}\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );

/** The shell commands a local composite action runs, recursively. */
const compositeActionCommands = (uses: string): string[] => {
  const actionDirectory = path.join(repositoryRoot, uses);
  const actionFile = ["action.yml", "action.yaml"]
    .map((name) => path.join(actionDirectory, name))
    .find((candidate) => existsSync(candidate));
  if (actionFile === undefined) {
    throw new Error(`Local action ${uses} has no action.yml`);
  }
  const action = readYaml(actionFile) as { runs: { steps?: Step[] } };
  return (action.runs.steps ?? []).flatMap(stepCommands);
};

/** The shell commands a step runs, following local composite actions. */
const stepCommands = (step: Step): string[] => {
  if (step.run !== undefined) return [step.run];
  if (step.uses?.startsWith("./")) return compositeActionCommands(step.uses);
  return [];
};

type JobInstance = { id: string; name: string; commands: string[] };

/**
 * The check runs a job produces. A matrix job produces one per `include`
 * entry, each with `${{ matrix.* }}` resolved in its name and commands, which
 * is also what GitHub reports as the status check's name.
 */
const jobInstances = (workflow: Workflow): JobInstance[] =>
  Object.entries(workflow.jobs).flatMap(([id, job]) => {
    const variants = job.strategy?.matrix?.include ?? [{}];
    return variants.map((values) => ({
      id,
      name: substituteMatrix(job.name ?? id, values),
      commands: (job.steps ?? [])
        .flatMap(stepCommands)
        .map((command) => substituteMatrix(command, values)),
    }));
  });

const allCommands = (workflow: Workflow): string =>
  jobInstances(workflow)
    .flatMap((instance) => instance.commands)
    .join("\n");

/** True when `commands` invokes `bun run <script>` as a whole word. */
const runsScript = (commands: string, script: string): boolean =>
  new RegExp(
    `\\bbun run ${script.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w:-])`,
  ).test(commands);

const fansOutToEveryWorkspace = (script: string | undefined) =>
  script !== undefined && /--filter\s+(['"])\*\1/.test(script);

const workflowEvents = (on: unknown): string[] => {
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  return Object.keys(on as Record<string, unknown>);
};

const bunExecutable = process.execPath;

const run = (
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string } = {},
) =>
  spawnSync(bunExecutable, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: PROCESS_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });

const git = (...args: string[]) =>
  spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });

describe("Issue #18: repository quality gates in CI", () => {
  test("CI installs dependencies from the committed lockfile", () => {
    expect(git("ls-files", "--error-unmatch", "bun.lock").status).toBe(0);

    for (const file of workflowFiles()) {
      for (const instance of jobInstances(readWorkflow(file))) {
        const label = `${path.basename(file)} / ${instance.name}`;
        const installs = instance.commands.filter((command) =>
          /\bbun (install|i)\b/.test(command),
        );

        for (const install of installs) {
          expect(`${label}: ${install}`).toContain("--frozen-lockfile");
        }

        const usesBun = instance.commands.some((command) =>
          /\bbunx? /.test(command),
        );
        if (usesBun) {
          expect({ label, installsFromLockfile: installs.length > 0 }).toEqual({
            label,
            installsFromLockfile: true,
          });
        }
      }
    }
  });

  test("formatting, lint, and TypeScript checks run for every affected package", () => {
    const commands = allCommands(readWorkflow(pullRequestWorkflowPath));
    for (const script of ["format:check", "lint", "typecheck"]) {
      expect({
        script,
        runInPullRequests: runsScript(commands, script),
      }).toEqual({
        script,
        runInPullRequests: true,
      });
    }

    // Prettier over the whole repository covers every package, including ones
    // added later; lint and typecheck fan out to every workspace.
    expect(rootPackage.scripts["format:check"]).toMatch(
      /prettier --check \.(\s|$)/,
    );
    expect(fansOutToEveryWorkspace(rootPackage.scripts.lint)).toBe(true);
    expect(fansOutToEveryWorkspace(rootPackage.scripts.typecheck)).toBe(true);

    for (const workspace of workspacePackages()) {
      expect({
        name: workspace.name,
        lint: typeof workspace.scripts.lint,
      }).toEqual({
        name: workspace.name,
        lint: "string",
      });
      expect({
        name: workspace.name,
        typecheck: typeof workspace.scripts.typecheck,
      }).toEqual({ name: workspace.name, typecheck: "string" });
    }
  });

  test("unit, API, and UI tests run at their defined boundaries (mobile is V2 and has no workspace)", () => {
    const pullRequest = allCommands(readWorkflow(pullRequestWorkflowPath));
    const nightly = allCommands(readWorkflow(nightlyWorkflowPath));

    // ADR-0034/ADR-0043: pull requests run Small and Medium, the nightly
    // schedule adds Large. Storybook is the component-UI boundary and the
    // browser E2E suite the page-UI boundary.
    const expected: [string, string, string][] = [
      ["pull request", "test:small", pullRequest],
      ["pull request", "test:medium", pullRequest],
      ["pull request", "test:storybook", pullRequest],
      ["pull request", "e2e:medium", pullRequest],
      ["nightly", "test:large", nightly],
      ["nightly", "e2e:large", nightly],
    ];
    for (const [event, script, commands] of expected) {
      expect({ event, script, runs: runsScript(commands, script) }).toEqual({
        event,
        script,
        runs: true,
      });
    }

    for (const script of ["test:small", "test:medium", "test:large"]) {
      expect(fansOutToEveryWorkspace(rootPackage.scripts[script])).toBe(true);
      for (const workspace of workspacePackages()) {
        expect({
          name: workspace.name,
          script,
          defined: script in workspace.scripts,
        }).toEqual({
          name: workspace.name,
          script,
          defined: true,
        });
      }
    }
  });

  test("every acceptance test is registered with a runner CI executes", () => {
    const registries = [
      path.join(
        repositoryRoot,
        "apps",
        "web",
        "frontend",
        "playwright.config.ts",
      ),
      ...workspacePackages()
        .map((workspace) => path.join(workspace.directory, "vitest.config.ts"))
        .filter((file) => existsSync(file)),
      path.join(repositoryRoot, "package.json"),
      ...workflowFiles(),
    ].map((file) => readFileSync(file, "utf8"));

    const acceptanceTests = readdirSync(
      path.join(repositoryRoot, "acceptance"),
    ).filter((name) => /\.test\.tsx?$/.test(name));

    for (const name of acceptanceTests) {
      const registered = registries.some((text) => text.includes(name));
      expect({ name, registered }).toEqual({ name, registered: true });
    }

    // This file is a Medium gate, so it has to run on pull requests, either
    // named in the workflow or through a root script the workflow runs.
    const pullRequestText = readFileSync(pullRequestWorkflowPath, "utf8");
    const pullRequestCommands = allCommands(
      readWorkflow(pullRequestWorkflowPath),
    );
    const runOnPullRequests =
      pullRequestText.includes(thisFileName) ||
      Object.entries(rootPackage.scripts).some(
        ([script, body]) =>
          body.includes(thisFileName) &&
          runsScript(pullRequestCommands, script),
      );
    expect({ file: thisFileName, runOnPullRequests }).toEqual({
      file: thisFileName,
      runOnPullRequests: true,
    });
  });

  test(
    "coverage reports are produced in a readable summary, and every reported overall metric is at least 80%",
    () => {
      const commands = allCommands(readWorkflow(pullRequestWorkflowPath));
      expect(runsScript(commands, "test:coverage:pr")).toBe(true);

      const startedAt = Date.now();
      const result = run(["run", "test:coverage:pr"]);
      const output = `${result.stdout}\n${result.stderr}`;
      expect({
        status: result.status,
        tail: output.slice(-4000),
      }).toMatchObject({
        status: 0,
      });

      for (const workspace of workspacePackages()) {
        // The human-readable table in the log, per package.
        const packageLines = output
          .split(/\r?\n/)
          .filter((line) =>
            line.startsWith(`${workspace.name} test:coverage:pr:`),
          )
          .join("\n");
        expect({
          name: workspace.name,
          readableSummary: /% Stmts|Statements\s*:/.test(packageLines),
        }).toEqual({ name: workspace.name, readableSummary: true });

        // The machine-readable overall summary from this run.
        const summaryPath = path.join(
          workspace.directory,
          "coverage",
          "coverage-summary.json",
        );
        expect({
          name: workspace.name,
          summary: existsSync(summaryPath),
        }).toEqual({
          name: workspace.name,
          summary: true,
        });
        expect(statSync(summaryPath).mtimeMs).toBeGreaterThanOrEqual(
          startedAt - 1_000,
        );

        const { total } = readJson(summaryPath) as {
          total: Record<string, { pct: number }>;
        };
        for (const metric of ["lines", "statements", "functions", "branches"]) {
          expect({
            name: workspace.name,
            metric,
            atLeast80: total[metric].pct >= 80,
          }).toEqual({
            name: workspace.name,
            metric,
            atLeast80: true,
          });
        }
      }
    },
    PROCESS_TIMEOUT_MS,
  );

  test(
    "frontend and Worker production builds are validated without credentials (Android is V2 and has no workspace)",
    () => {
      const workflow = readWorkflow(pullRequestWorkflowPath);
      expect(runsScript(allCommands(workflow), "build")).toBe(true);
      expect(fansOutToEveryWorkspace(rootPackage.scripts.build)).toBe(true);

      for (const name of ["@zipnami/web-frontend", "@zipnami/web-backend"]) {
        const workspace = workspacePackages().find(
          (entry) => entry.name === name,
        );
        expect({ name, build: typeof workspace?.scripts.build }).toEqual({
          name,
          build: "string",
        });
      }

      // Drop anything that looks like a credential, then supply only the
      // placeholder origin the workflow itself provides.
      const env: NodeJS.ProcessEnv = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !/TOKEN|SECRET|PASSWORD|API_KEY|CLOUDFLARE|ADSENSE|MAPS|CF_/i.test(
              key,
            ),
        ),
      );
      Object.assign(env, workflow.env ?? {});

      const result = run(["run", "build"], { env });
      expect({
        status: result.status,
        tail: `${result.stdout}\n${result.stderr}`.slice(-4000),
      }).toMatchObject({ status: 0 });

      expect(
        existsSync(
          path.join(
            repositoryRoot,
            "apps",
            "web",
            "frontend",
            "dist",
            "index.html",
          ),
        ),
      ).toBe(true);
      expect(
        readdirSync(
          path.join(repositoryRoot, "apps", "web", "backend", "dist"),
        ).some((name) => name.endsWith(".js")),
      ).toBe(true);
    },
    PROCESS_TIMEOUT_MS,
  );

  test(
    "generated postal data is checked for drift on every pull request",
    () => {
      const commands = allCommands(readWorkflow(pullRequestWorkflowPath));
      expect({
        runInPullRequests: runsScript(commands, "check:postal-data"),
      }).toEqual({
        runInPullRequests: true,
      });

      const committed = run(["run", "check:postal-data"]);
      expect({
        committedArtifact: committed.status,
        tail: `${committed.stdout}\n${committed.stderr}`.slice(-4000),
      }).toMatchObject({ committedArtifact: 0 });

      const original = readFileSync(generatedPostalDataPath);
      const entries = JSON.parse(original.toString("utf8")) as unknown[];
      try {
        // A drifted artifact: one postal code missing from what regeneration
        // would produce.
        writeFileSync(
          generatedPostalDataPath,
          `${JSON.stringify(entries.slice(1), null, 2)}\n`,
        );
        const drifted = run(["run", "check:postal-data"]);
        expect({
          driftedArtifact: drifted.status === 0 ? "passed" : "failed",
        }).toEqual({
          driftedArtifact: "failed",
        });
      } finally {
        writeFileSync(generatedPostalDataPath, original);
      }
      expect(readFileSync(generatedPostalDataPath).equals(original)).toBe(true);
    },
    PROCESS_TIMEOUT_MS,
  );

  test("the gating workflow runs on every pull request so its required checks always report", () => {
    // ADR-0042: a required check from a workflow with a path or branch filter
    // is never created for a pull request outside the filter, and GitHub then
    // blocks that pull request forever instead of on a failure.
    const workflow = readWorkflow(pullRequestWorkflowPath);
    expect(workflowEvents(workflow.on)).toContain("pull_request");
    const trigger =
      typeof workflow.on === "object" &&
      workflow.on !== null &&
      !Array.isArray(workflow.on)
        ? (workflow.on as Record<string, unknown>).pull_request
        : null;
    const filters =
      trigger !== null && typeof trigger === "object"
        ? Object.keys(trigger).filter((key) =>
            ["paths", "paths-ignore", "branches", "branches-ignore"].includes(
              key,
            ),
          )
        : [];
    expect(filters).toEqual([]);
  });

  test("CI does not expose deployment, Maps, or advertising secrets to untrusted jobs", () => {
    for (const file of workflowFiles()) {
      const text = readFileSync(file, "utf8");
      const workflow = readWorkflow(file);
      const events = workflowEvents(workflow.on);
      const label = path.basename(file);

      // pull_request_target and workflow_run run with secrets on behalf of
      // code the repository has not reviewed.
      expect({
        label,
        privilegedTriggers: events.filter((event) =>
          ["pull_request_target", "workflow_run"].includes(event),
        ),
      }).toEqual({ label, privilegedTriggers: [] });

      if (!events.includes("pull_request")) continue;

      const secrets = [...text.matchAll(/secrets\.(\w+)/g)]
        .map((match) => match[1])
        .filter((name) => name !== "GITHUB_TOKEN");
      expect({ label, secrets }).toEqual({ label, secrets: [] });

      // A read-only token: nothing a pull request runs can write back.
      expect({ label, permissions: workflow.permissions }).toEqual({
        label,
        permissions: { contents: "read" },
      });
      for (const [id, job] of Object.entries(workflow.jobs)) {
        const writes = Object.entries(
          (job.permissions ?? {}) as Record<string, string>,
        ).filter(([, level]) => level === "write");
        expect({ label, job: id, writes }).toEqual({
          label,
          job: id,
          writes: [],
        });
      }
    }
  });
});
