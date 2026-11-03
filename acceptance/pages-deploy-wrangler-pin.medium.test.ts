import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #90: Pin wrangler for the Pages deploy so
 * Cloudflare cannot turn it into a Worker.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What "pinned" means here
 * ------------------------
 * A workflow step runs `bunx wrangler` from its working directory. bunx uses
 * the wrangler that directory's workspace installed from bun.lock, and only
 * when the workspace declares none does it download the newest release at
 * run time. So a step is pinned exactly when the package.json of its working
 * directory declares wrangler. Rollback of the Pages half calls Cloudflare's
 * API with curl and runs no wrangler, so it has nothing to pin.
 *
 * The third criterion, that the first production deploy creates a deployment
 * on the classic Pages project rather than a Worker, needs Cloudflare and is
 * checked when #19 deploys. It is not exercised here.
 *
 * The Issue's Out of scope section (moving the frontend to Workers static
 * assets) is not exercised here.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");

type Step = {
  name?: string;
  run?: string;
  "working-directory"?: string;
};
type Workflow = { jobs: Record<string, { steps?: Step[] }> };
type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const RUNS_WRANGLER = /(^|[\s;&|(])(bunx\s+)?wrangler\s/m;

const wranglerSteps = (): { file: string; step: Step }[] =>
  readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((file) => {
      const workflow = Bun.YAML.parse(
        readFileSync(path.join(workflowsDirectory, file), "utf8"),
      ) as Workflow;

      return Object.values(workflow.jobs)
        .flatMap((job) => job.steps ?? [])
        .filter((step) => RUNS_WRANGLER.test(step.run ?? ""))
        .map((step) => ({ file, step }));
    });

const declaredWrangler = (workspace: string): string | undefined => {
  const manifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, workspace, "package.json"), "utf8"),
  ) as Manifest;

  return manifest.devDependencies?.wrangler ?? manifest.dependencies?.wrangler;
};

describe("Issue #90: a pinned wrangler for the Pages deploy", () => {
  test("every workflow step that runs wrangler does so from a workspace that pins it in bun.lock", () => {
    const steps = wranglerSteps();

    // Without this, a workflow that stopped running wrangler at all would
    // pass vacuously.
    expect(
      steps.map(({ file }) => file),
      "no workflow step runs wrangler",
    ).toContain("deploy.yml");

    const unpinned = steps
      .filter(({ step }) => {
        const directory = step["working-directory"];
        return (
          directory === undefined || declaredWrangler(directory) === undefined
        );
      })
      .map(({ file, step }) => `${file}: ${step.name ?? step.run}`);

    expect(unpinned).toEqual([]);
  });

  test("the Pages deploy runs the same wrangler version as the Worker deploy", () => {
    expect(declaredWrangler("apps/web/frontend")).toBeDefined();
    expect(declaredWrangler("apps/web/frontend")).toBe(
      declaredWrangler("apps/web/backend"),
    );
  });

  test("docs/deployment.md creates a classic Pages project and warns not to run it inside apps/web/backend", () => {
    const deployment = readFileSync(
      path.join(repositoryRoot, "docs", "deployment.md"),
      "utf8",
    );

    const creates = [...deployment.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
      .map(([, block]) => block)
      .filter((block) => /wrangler\s+pages\s+project\s+create\b/.test(block));

    expect(creates.length, "no code block creates the Pages project").toBe(1);
    expect(creates[0]).toMatch(/--force\b/);

    // The step that creates the project, from its number to the next one.
    const step = /\n1\. [\s\S]*?(?=\n2\. )/.exec(deployment)?.[0] ?? "";

    expect(step).toMatch(/pages project create/);
    expect(step).toMatch(/apps\/web\/backend/);
  });
});
