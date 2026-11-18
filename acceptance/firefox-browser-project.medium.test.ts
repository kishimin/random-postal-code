import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #132, criterion 2: "playwright.config.ts has a
 * Firefox project, and Frontend E2E (Medium) passes on a pull request for all
 * six projects."
 *
 * Each test name states the part of the criterion it holds, so a failure names
 * the part that broke rather than only the assertion.
 *
 * What is and is not exercised here
 * ---------------------------------
 * The passing half is proven by the Frontend E2E (Medium) check itself on the
 * pull request: that job is required by the main ruleset, so a pull request
 * whose Firefox run fails cannot merge. What this test holds is what that
 * proof depends on and the check cannot see on its own:
 *
 * - the config really has a project that launches Firefox, next to the five
 *   existing ones, so the job runs six projects and not five;
 * - every CI job that runs the browser tests from that config installs
 *   Firefox. Without it, the Firefox project fails at launch on the runner
 *   ("Executable doesn't exist"), and a job that only installs chromium and
 *   webkit would be "fixed" by removing the project again.
 *
 * The other criteria of Issue #132 (the release, the recording, the video,
 * the upload, and the X drafts) are not exercised here.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendDirectory = path.join(repositoryRoot, "apps", "web", "frontend");
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");

type Project = { name?: string; use?: { browserName?: string } };
type Step = { uses?: string; run?: string; with?: Record<string, string> };
type Job = { name?: string; steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };

const EXISTING_PROJECTS = [
  "Google Chrome",
  "Microsoft Edge",
  "Safari",
  "Android (Chrome)",
  "iPhone (Safari)",
];

const loadProjects = async (): Promise<Project[]> => {
  const module = (await import(
    path.join(frontendDirectory, "playwright.config.ts")
  )) as { default: { projects?: Project[] } };

  return module.default.projects ?? [];
};

// A job runs the browser tests of playwright.config.ts when one of its steps
// runs the frontend's e2e:small or e2e:medium script. e2e:large and
// e2e:production use configs of their own and are not part of this criterion.
const RUNS_DEFAULT_CONFIG = /\bbun run e2e:(small|medium)\b/;

const browserTestJobs = (): { file: string; job: Job }[] =>
  readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((file) => {
      const workflow = Bun.YAML.parse(
        readFileSync(path.join(workflowsDirectory, file), "utf8"),
      ) as Workflow;

      return Object.values(workflow.jobs)
        .filter((job) =>
          (job.steps ?? []).some((step) =>
            RUNS_DEFAULT_CONFIG.test(step.run ?? ""),
          ),
        )
        .map((job) => ({ file, job }));
    });

const installedBrowsers = (job: Job): string[] =>
  (job.steps ?? [])
    .filter((step) => step.uses === "./.github/actions/setup-frontend")
    .flatMap((step) => (step.with?.["playwright-browsers"] ?? "").split(/\s+/))
    .filter((browser) => browser !== "");

describe("Issue #132: Firefox in the browser test matrix", () => {
  test("playwright.config.ts has a project that launches Firefox", async () => {
    const firefox = (await loadProjects()).filter(
      (project) => project.use?.browserName === "firefox",
    );

    expect(firefox.map((project) => project.name)).toEqual(["Firefox"]);
  });

  test("the Firefox project is added next to the five existing projects, which are kept", async () => {
    const names = (await loadProjects()).map((project) => project.name);

    expect(names).toEqual([...EXISTING_PROJECTS, "Firefox"]);
  });

  test("every CI job that runs the browser tests of playwright.config.ts installs Firefox", () => {
    const jobs = browserTestJobs();

    // Without this, a workflow that stopped running the Medium browser tests
    // would pass vacuously.
    expect(
      jobs.map(({ job }) => job.name),
      "no CI job runs the Medium browser tests",
    ).toContain("Frontend E2E (Medium)");

    const missing = jobs
      .filter(({ job }) => !installedBrowsers(job).includes("firefox"))
      .map(({ file, job }) => `${file}: ${job.name}`);

    expect(missing).toEqual([]);
  });
});
