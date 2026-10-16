import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #18, criterion "A failing required check blocks
 * merge."
 *
 * Why this is a separate, Large file
 * ----------------------------------
 * Whether a failing check blocks a merge is decided by the repository's
 * ruleset on GitHub, not by anything committed. The only way to observe it is
 * to ask GitHub, which needs the network, so this criterion cannot share the
 * Medium file (`ci-quality-gates.medium.test.ts`) that holds the rest of the
 * Issue (ADR-0004, ADR-0044). It runs under `bun test` for the same reason as
 * that file: Bun's built-in YAML parser reads the workflow without a new
 * dependency.
 *
 * What is asserted
 * ----------------
 * - The default branch accepts changes only through pull requests.
 * - Every required status check is one the pull request workflow actually
 *   produces. A required check nobody produces blocks every pull request
 *   regardless of its result (ADR-0031, ADR-0042).
 * - Every pull request job that runs a repository quality command is
 *   required, so its failure blocks the merge instead of only showing red.
 *
 * What is not asserted, and why
 * -----------------------------
 * Whether anyone can bypass the ruleset. GitHub returns `bypass_actors` only
 * to a caller with admin rights on the repository; the token CI hands a job
 * does not have them, so this test cannot observe it where it runs. It was
 * confirmed by hand for Issue #18 (`bypass_actors: []`) and is recorded in the
 * pull request rather than asserted here.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pullRequestWorkflowPath = path.join(
  repositoryRoot,
  ".github",
  "workflows",
  "ci-pull-request.yml",
);

const NETWORK_TIMEOUT_MS = 60_000;

type Step = { run?: string; uses?: string };
type Job = {
  name?: string;
  steps?: Step[];
  strategy?: { matrix?: { include?: Record<string, string>[] } };
};
type Workflow = { jobs: Record<string, Job> };

const readYaml = (filePath: string): unknown =>
  Bun.YAML.parse(readFileSync(filePath, "utf8"));

const substituteMatrix = (text: string, values: Record<string, string>) =>
  text.replaceAll(/\$\{\{\s*matrix\.(\w+)\s*\}\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );

const stepCommands = (step: Step): string[] => {
  if (step.run !== undefined) return [step.run];
  if (step.uses?.startsWith("./")) {
    const directory = path.join(repositoryRoot, step.uses);
    const file = ["action.yml", "action.yaml"]
      .map((name) => path.join(directory, name))
      .find((candidate) => existsSync(candidate));
    if (file === undefined) throw new Error(`No action.yml in ${step.uses}`);
    const action = readYaml(file) as { runs: { steps?: Step[] } };
    return (action.runs.steps ?? []).flatMap(stepCommands);
  }
  return [];
};

/** Status check names the pull request workflow produces, with their commands. */
const pullRequestChecks = () => {
  const workflow = readYaml(pullRequestWorkflowPath) as Workflow;
  return Object.entries(workflow.jobs).flatMap(([id, job]) =>
    (job.strategy?.matrix?.include ?? [{}]).map((values) => ({
      name: substituteMatrix(job.name ?? id, values),
      // Only the job's own steps: the shared setup action runs `bun install`
      // for every job, and installing is not a quality gate.
      ownCommands: (job.steps ?? [])
        .filter((step) => step.run !== undefined)
        .flatMap(stepCommands)
        .map((command) => substituteMatrix(command, values)),
    })),
  );
};

/** `owner/name`, from CI's environment or from the origin remote. */
const repositorySlug = (): string => {
  const fromEnvironment = process.env.GITHUB_REPOSITORY;
  if (fromEnvironment) return fromEnvironment;
  const origin = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).stdout.trim();
  const match = /github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(origin);
  if (match === null)
    throw new Error(`Cannot read a GitHub slug from ${origin}`);
  return match[1];
};

/*
 * A nightly run that cannot reach GitHub has not found a misconfigured
 * ruleset, and its report must not read as if it had (Issue #48). Transient
 * failures (a network error, a 5xx, 429, or a rate-limited 403) are retried
 * with backoff. If they persist, the error says the API was unavailable,
 * which is distinct both from a refused request and from a ruleset that
 * does not match the workflow.
 */
const GITHUB_ATTEMPTS = 3;

// The longest a retry-after header is honored; a nightly job should fail
// with a clear message rather than sleep for many minutes.
const MAX_RETRY_AFTER_MS = 60_000;

/*
 * A 403 is a rate limit, not a refusal, when GitHub says so. A primary
 * limit sets x-ratelimit-remaining to 0. A secondary limit may instead send
 * retry-after, or only name the limit in its message (GitHub's REST
 * rate-limit guidance).
 */
const isTransient = async (response: Response): Promise<boolean> => {
  if (response.status >= 500 || response.status === 429) return true;
  if (response.status !== 403) return false;
  if (response.headers.get("x-ratelimit-remaining") === "0") return true;
  if (response.headers.get("retry-after") !== null) return true;
  return /rate limit/i.test(await response.clone().text());
};

/** How long to wait before the next attempt: retry-after if sent, else backoff. */
const retryDelayMs = (response: Response | undefined, attempt: number) => {
  const retryAfter = Number(response?.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS)
    : 1000 * 2 ** (attempt - 2);
};

const github = async (resource: string): Promise<unknown> => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const failures: string[] = [];
  let previous: Response | undefined;

  for (let attempt = 1; attempt <= GITHUB_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await Bun.sleep(retryDelayMs(previous, attempt));
    }

    let response: Response;
    try {
      response = await fetch(`https://api.github.com/${resource}`, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      failures.push(`network error: ${String(error)}`);
      previous = undefined;
      continue;
    }

    if (response.ok) return response.json();
    previous = response;
    if (!(await isTransient(response))) {
      throw new Error(
        `GitHub API refused GET ${resource}: HTTP ${response.status} (not a ruleset mismatch)`,
      );
    }
    failures.push(`HTTP ${response.status}`);
  }

  throw new Error(
    `GitHub API unavailable for GET ${resource} after ${GITHUB_ATTEMPTS} attempts (${failures.join("; ")}); this is not a ruleset mismatch`,
  );
};

type Rule = {
  type: string;
  parameters?: { required_status_checks?: { context: string }[] };
};

describe("Issue #18: a failing required check blocks merge", () => {
  test(
    "the default branch requires every pull request quality check, and only checks that exist",
    async () => {
      const slug = repositorySlug();
      const repository = (await github(`repos/${slug}`)) as {
        default_branch: string;
      };
      const rules = (await github(
        `repos/${slug}/rules/branches/${encodeURIComponent(repository.default_branch)}`,
      )) as Rule[];

      expect(rules.map((rule) => rule.type)).toContain("pull_request");

      const required = new Set(
        rules
          .filter((rule) => rule.type === "required_status_checks")
          .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
          .map((check) => check.context),
      );
      expect(required.size).toBeGreaterThan(0);

      const checks = pullRequestChecks();
      const produced = new Set(checks.map((check) => check.name));
      const phantom = [...required].filter((name) => !produced.has(name));
      expect({ phantomRequiredChecks: phantom }).toEqual({
        phantomRequiredChecks: [],
      });

      const gates = checks
        .filter((check) =>
          check.ownCommands.some((command) => /\bbunx? /.test(command)),
        )
        .map((check) => check.name);
      expect(gates.length).toBeGreaterThan(0);
      const unrequiredGates = gates.filter((name) => !required.has(name));
      expect({ unrequiredGates }).toEqual({ unrequiredGates: [] });
    },
    NETWORK_TIMEOUT_MS,
  );
});
