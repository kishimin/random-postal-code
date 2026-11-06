// Picks which halves an automatic deploy ships (Issue #108). deploy.yml runs
// this in its "Plan deploy" job when CI (Push) succeeds on main; a manual
// dispatch chooses its halves itself and never gets here.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BOTH = { frontend: true, backend: true };

// Only the directory itself counts, so apps/web/frontend-tools is not the
// frontend and falls through to "both".
const under = (file, directory) => file.startsWith(`${directory}/`);

const halvesOf = (file) => {
  if (
    under(file, "docs") ||
    under(file, "acceptance") ||
    file.endsWith(".md") ||
    file === "LICENSE"
  ) {
    return [];
  }
  if (under(file, "apps/web/frontend")) {
    return ["frontend"];
  }
  if (under(file, "apps/web/backend") || under(file, "packages/postal-data")) {
    return ["backend"];
  }
  // Shared code, the lockfile, the toolchain, or the workflows: deploying a
  // half that did not need it costs one redundant version, while skipping one
  // that did leaves production behind main.
  return ["frontend", "backend"];
};

/**
 * @param {{ changedFiles: string[] | null, previousDeploySucceeded: boolean }} facts
 *   `changedFiles` is null when the previous verified commit is unknown.
 * @returns {{ frontend: boolean, backend: boolean }}
 */
export const planDeploy = ({ changedFiles, previousDeploySucceeded }) => {
  // The diff only covers what changed since the last verified commit. If the
  // deploy for that commit never succeeded, its changes are not live either.
  if (changedFiles === null || !previousDeploySucceeded) {
    return BOTH;
  }
  const halves = new Set(changedFiles.flatMap(halvesOf));
  return { frontend: halves.has("frontend"), backend: halves.has("backend") };
};

/**
 * The head commit of the last successful CI run before the triggering one.
 *
 * @param {{ id: number, head_sha: string, conclusion: string | null }[]} runs
 *   CI (Push) runs on main, newest first, as the GitHub API lists them.
 * @param {number} triggeringRunId
 * @returns {string | null}
 */
export const previousVerifiedCommit = (runs, triggeringRunId) => {
  const index = runs.findIndex((run) => run.id === triggeringRunId);
  if (index === -1) {
    return null;
  }
  return (
    runs.slice(index + 1).find((run) => run.conclusion === "success")
      ?.head_sha ?? null
  );
};

/**
 * Whether the deploy.yml run just before the current one succeeded. A newer
 * run that replaced it while it waited for the concurrency group leaves it
 * cancelled, so its commit was never deployed.
 *
 * @param {{ id: number, conclusion: string | null }[]} runs
 *   deploy.yml runs, newest first.
 * @param {number} currentRunId
 * @returns {boolean}
 */
export const previousDeploySucceeded = (runs, currentRunId) => {
  const index = runs.findIndex((run) => run.id === currentRunId);
  return index !== -1 && runs[index + 1]?.conclusion === "success";
};

const workflowRuns = (repository, workflow, query) =>
  JSON.parse(
    execFileSync(
      "gh",
      [
        "api",
        `repos/${repository}/actions/workflows/${workflow}/runs?${query}&per_page=50`,
        "--jq",
        ".workflow_runs",
      ],
      { encoding: "utf8" },
    ),
  );

const changedFilesBetween = (base, head) => {
  try {
    return execFileSync("git", ["diff", "--name-only", base, head], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    // The base is gone from history (a force push): treat it as unknown.
    return null;
  }
};

const main = () => {
  const {
    GITHUB_REPOSITORY,
    GITHUB_RUN_ID,
    CI_RUN_ID,
    HEAD_SHA,
    GITHUB_OUTPUT,
  } = process.env;

  const base = previousVerifiedCommit(
    workflowRuns(GITHUB_REPOSITORY, "ci-push.yml", "branch=main&event=push"),
    Number(CI_RUN_ID),
  );
  const plan = planDeploy({
    changedFiles: base === null ? null : changedFilesBetween(base, HEAD_SHA),
    previousDeploySucceeded: previousDeploySucceeded(
      workflowRuns(GITHUB_REPOSITORY, "deploy.yml", "branch=main"),
      Number(GITHUB_RUN_ID),
    ),
  });

  console.log(
    `Previous verified commit: ${base ?? "unknown"}. Deploying frontend: ${plan.frontend}, backend: ${plan.backend}.`,
  );
  appendFileSync(
    GITHUB_OUTPUT,
    `frontend=${plan.frontend}\nbackend=${plan.backend}\n`,
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
