import assert from "node:assert/strict";
import { test } from "node:test";

import {
  planDeploy,
  previousDeploySucceeded,
  previousVerifiedCommit,
} from "./plan-deploy.mjs";

const changed = (...changedFiles) =>
  planDeploy({ changedFiles, previousDeploySucceeded: true });

test("a frontend change deploys Pages only", () => {
  assert.deepEqual(changed("apps/web/frontend/src/main.tsx"), {
    frontend: true,
    backend: false,
  });
});

test("a backend or postal-data change deploys the Worker only", () => {
  assert.deepEqual(changed("apps/web/backend/src/app.ts"), {
    frontend: false,
    backend: true,
  });
  assert.deepEqual(changed("packages/postal-data/src/parse.ts"), {
    frontend: false,
    backend: true,
  });
});

test("documentation, acceptance tests, and the licence deploy nothing", () => {
  assert.deepEqual(
    changed(
      "docs/deployment.md",
      "acceptance/web-auto-deploy.medium.test.ts",
      "README.md",
      "apps/web/backend/README.md",
      "LICENSE",
    ),
    { frontend: false, backend: false },
  );
});

test("a path outside both halves deploys both", () => {
  for (const file of [
    "packages/shared/src/index.ts",
    "bun.lock",
    "package.json",
    ".github/workflows/deploy.yml",
  ]) {
    assert.deepEqual(changed(file), { frontend: true, backend: true }, file);
  }
});

test("a prefix only counts at a directory boundary", () => {
  // apps/web/frontend-tools is not the frontend.
  assert.deepEqual(changed("apps/web/frontend-tools/x.ts"), {
    frontend: true,
    backend: true,
  });
});

test("an empty change deploys nothing", () => {
  assert.deepEqual(changed(), { frontend: false, backend: false });
});

test("an unknown base or a failed previous deploy deploys both", () => {
  assert.deepEqual(
    planDeploy({ changedFiles: null, previousDeploySucceeded: true }),
    { frontend: true, backend: true },
  );
  assert.deepEqual(
    planDeploy({ changedFiles: ["docs/a.md"], previousDeploySucceeded: false }),
    { frontend: true, backend: true },
  );
});

// Runs as the GitHub API lists them: newest first.
const ciRuns = [
  { id: 5, head_sha: "e", conclusion: null },
  { id: 4, head_sha: "d", conclusion: "success" },
  { id: 3, head_sha: "c", conclusion: "failure" },
  { id: 2, head_sha: "b", conclusion: "cancelled" },
  { id: 1, head_sha: "a", conclusion: "success" },
];

test("the previous verified commit is the last successful CI run before the triggering one", () => {
  assert.equal(previousVerifiedCommit(ciRuns, 4), "a");
});

test("the previous verified commit is unknown when none precedes it or the run is not listed", () => {
  assert.equal(previousVerifiedCommit(ciRuns, 1), null);
  assert.equal(previousVerifiedCommit(ciRuns, 99), null);
});

const deployRuns = [
  { id: 30, conclusion: null },
  { id: 20, conclusion: "cancelled" },
  { id: 10, conclusion: "success" },
];

test("the previous deploy is the run listed right after the current one", () => {
  assert.equal(previousDeploySucceeded(deployRuns, 20), true);
  assert.equal(previousDeploySucceeded(deployRuns, 30), false);
});

test("with no earlier deploy, or the current run unlisted, it is not a success", () => {
  assert.equal(previousDeploySucceeded(deployRuns, 10), false);
  assert.equal(previousDeploySucceeded(deployRuns, 99), false);
});
