// Picks which halves an automatic deploy ships, and records what each half
// deployed (Issue #108). deploy.yml runs `plan` in its "Plan deploy" job when
// CI (Push) succeeds on main; a manual dispatch chooses its halves itself.
// Both kinds of run record their deploys, so the plan always compares with
// what production actually received.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BOTH = { frontend: true, backend: true };
const HALVES = ["frontend", "backend"];

// Its own environment rather than `production`: a record is bookkeeping, and
// the production environment's branch policy is for the jobs that hold the
// Cloudflare credentials.
const RECORD_ENVIRONMENT = "production-release";

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
 *   `changedFiles` is null when the last deployed commit is unknown.
 * @returns {{ frontend: boolean, backend: boolean }}
 */
export const planDeploy = ({ changedFiles, previousDeploySucceeded }) => {
  // A failed deploy may have left production half-updated, so the next run
  // ships again rather than trusting the diff.
  if (changedFiles === null || !previousDeploySucceeded) {
    return BOTH;
  }
  const halves = new Set(changedFiles.flatMap(halvesOf));
  return { frontend: halves.has("frontend"), backend: halves.has("backend") };
};

/**
 * @param {{ sha: string, state: string }[]} records
 *   One half's deploy records, newest first, each with its latest status.
 * @returns {{ lastSuccessSha: string | null, latestSucceeded: boolean }}
 */
export const deployHistory = (records) => ({
  lastSuccessSha:
    records.find((record) => record.state === "success")?.sha ?? null,
  latestSucceeded: records[0]?.state === "success",
});

/**
 * Each half is planned against the commit that half last deployed: a deploy
 * of the other half, or a CI run, says nothing about what this half has live.
 *
 * @param {{
 *   histories: Record<"frontend" | "backend", ReturnType<typeof deployHistory>>,
 *   changedSince: (sha: string) => string[] | null,
 *   isBehind: (sha: string) => boolean,
 * }} facts `isBehind(sha)` is true when the commit to deploy is `sha` or an
 *   ancestor of it.
 * @returns {{ frontend: boolean, backend: boolean }}
 */
export const planHalves = ({ histories, changedSince, isBehind }) =>
  Object.fromEntries(
    HALVES.map((half) => {
      const { lastSuccessSha, latestSucceeded } = histories[half];
      // A re-run of an old CI run would otherwise ship old code over newer
      // code. Going back is a rollback, which a person decides.
      if (lastSuccessSha !== null && isBehind(lastSuccessSha)) {
        return [half, false];
      }
      const plan = planDeploy({
        changedFiles:
          lastSuccessSha === null ? null : changedSince(lastSuccessSha),
        previousDeploySucceeded: latestSucceeded,
      });
      return [half, plan[half]];
    }),
  );

/** The GitHub deployment that records `half` deploying `sha`. */
export const deploymentRequest = (half, sha) => ({
  ref: sha,
  environment: RECORD_ENVIRONMENT,
  task: `deploy:${half}`,
  // Without these GitHub would try to merge the default branch into the ref
  // and require every commit status to pass; this only records a deploy.
  auto_merge: false,
  required_contexts: [],
  // Both halves share one environment. Outside a production environment,
  // GitHub marks earlier deployments inactive on every success, which would
  // erase the other half's last success.
  production_environment: true,
  description: `Zipnami ${half} deployed to Cloudflare`,
});

/**
 * The status that closes a deploy record, from the job's `job.status`
 * (success, failure, or cancelled). A cancelled deploy may have stopped
 * halfway, so it must not count as a success.
 */
export const deploymentStatus = (jobStatus) => ({
  state:
    jobStatus === "success"
      ? "success"
      : jobStatus === "failure"
        ? "failure"
        : "error",
  auto_inactive: false,
});

const gh = (args, input) =>
  execFileSync("gh", ["api", ...args], { encoding: "utf8", input });

const records = (repository, half) => {
  const deployments = JSON.parse(
    gh([
      `repos/${repository}/deployments?environment=${RECORD_ENVIRONMENT}&task=deploy:${half}&per_page=30`,
      "--jq",
      "[.[] | {id, sha}]",
    ]),
  );
  const found = [];
  // Stop at the first success: nothing older changes the history.
  for (const { id, sha } of deployments) {
    const state = gh([
      `repos/${repository}/deployments/${id}/statuses?per_page=1`,
      "--jq",
      '.[0].state // ""',
    ]).trim();
    found.push({ sha, state });
    if (state === "success") {
      break;
    }
  }
  return found;
};

const git = (args) => execFileSync("git", args, { encoding: "utf8" });

const changedSince = (head) => (base) => {
  try {
    return git(["diff", "--name-only", base, head]).split("\n").filter(Boolean);
  } catch {
    // The base is gone from history (a force push): treat it as unknown.
    return null;
  }
};

const isBehind = (head) => (base) => {
  try {
    git(["merge-base", "--is-ancestor", head, base]);
    return true;
  } catch {
    return false;
  }
};

const plan = ({ GITHUB_REPOSITORY, HEAD_SHA, GITHUB_OUTPUT }) => {
  const histories = Object.fromEntries(
    HALVES.map((half) => [
      half,
      deployHistory(records(GITHUB_REPOSITORY, half)),
    ]),
  );
  const halves = planHalves({
    histories,
    changedSince: changedSince(HEAD_SHA),
    isBehind: isBehind(HEAD_SHA),
  });

  for (const half of HALVES) {
    const { lastSuccessSha, latestSucceeded } = histories[half];
    console.log(
      `${half}: last deployed ${lastSuccessSha ?? "unknown"}, latest deploy ${latestSucceeded ? "succeeded" : "did not succeed"}, deploying ${halves[half]}.`,
    );
  }
  appendFileSync(
    GITHUB_OUTPUT,
    `frontend=${halves.frontend}\nbackend=${halves.backend}\n`,
  );
};

const recordStart = (
  half,
  { GITHUB_REPOSITORY, DEPLOYED_SHA, GITHUB_OUTPUT },
) => {
  const id = gh(
    [
      `repos/${GITHUB_REPOSITORY}/deployments`,
      "--method",
      "POST",
      "--input",
      "-",
      "--jq",
      ".id",
    ],
    JSON.stringify(deploymentRequest(half, DEPLOYED_SHA)),
  ).trim();
  gh(
    [
      `repos/${GITHUB_REPOSITORY}/deployments/${id}/statuses`,
      "--method",
      "POST",
      "--input",
      "-",
    ],
    JSON.stringify({ state: "in_progress", auto_inactive: false }),
  );
  appendFileSync(GITHUB_OUTPUT, `id=${id}\n`);
};

const recordFinish = ({ GITHUB_REPOSITORY, DEPLOYMENT_ID, OUTCOME }) => {
  gh(
    [
      `repos/${GITHUB_REPOSITORY}/deployments/${DEPLOYMENT_ID}/statuses`,
      "--method",
      "POST",
      "--input",
      "-",
    ],
    JSON.stringify(deploymentStatus(OUTCOME)),
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, half] = process.argv.slice(2);
  if (command === "plan") {
    plan(process.env);
  } else if (command === "record-start" && HALVES.includes(half)) {
    recordStart(half, process.env);
  } else if (command === "record-finish") {
    recordFinish(process.env);
  } else {
    throw new Error(`unknown command: ${process.argv.slice(2).join(" ")}`);
  }
}
