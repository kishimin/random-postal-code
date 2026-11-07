import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deployHistory,
  deploymentRequest,
  deploymentStatus,
  planDeploy,
  planHalves,
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

// Deploy records as the GitHub API lists them: newest first.
test("a half's history is its last successful commit and whether its latest deploy succeeded", () => {
  assert.deepEqual(
    deployHistory([
      { sha: "c", state: "failure" },
      { sha: "b", state: "success" },
      { sha: "a", state: "success" },
    ]),
    { lastSuccessSha: "b", latestSucceeded: false },
  );
  assert.deepEqual(deployHistory([{ sha: "c", state: "in_progress" }]), {
    lastSuccessSha: null,
    latestSucceeded: false,
  });
  assert.deepEqual(deployHistory([]), {
    lastSuccessSha: null,
    latestSucceeded: false,
  });
});

const succeededAt = (sha) => ({ lastSuccessSha: sha, latestSucceeded: true });
const filesSince = (bySha) => (sha) => bySha[sha] ?? [];
const behindNone = () => false;

test("each half diffs against the commit it last deployed, not the other half's", () => {
  // A manual frontend deploy at b must not hide backend changes since a.
  assert.deepEqual(
    planHalves({
      histories: { frontend: succeededAt("b"), backend: succeededAt("a") },
      changedSince: filesSince({
        a: ["apps/web/backend/src/app.ts", "docs/design.md"],
        b: ["docs/design.md"],
      }),
      isBehind: behindNone,
    }),
    { frontend: false, backend: true },
  );
});

test("a half whose latest deploy failed deploys again, even when nothing new changed", () => {
  assert.deepEqual(
    planHalves({
      histories: {
        frontend: succeededAt("b"),
        backend: { lastSuccessSha: "a", latestSucceeded: false },
      },
      changedSince: filesSince({
        a: ["docs/design.md"],
        b: ["docs/design.md"],
      }),
      isBehind: behindNone,
    }),
    { frontend: false, backend: true },
  );
});

test("a half with no deploy record deploys", () => {
  assert.deepEqual(
    planHalves({
      histories: {
        frontend: { lastSuccessSha: null, latestSucceeded: false },
        backend: succeededAt("a"),
      },
      changedSince: filesSince({ a: [] }),
      isBehind: behindNone,
    }),
    { frontend: true, backend: false },
  );
});

test("a commit at or behind what a half last deployed is not deployed again", () => {
  // A re-run of an old CI run must not ship old code over newer code, even
  // when that half's latest deploy failed.
  assert.deepEqual(
    planHalves({
      histories: {
        frontend: succeededAt("new"),
        backend: { lastSuccessSha: "new", latestSucceeded: false },
      },
      changedSince: filesSince({
        new: ["apps/web/frontend/src/main.tsx", "apps/web/backend/src/app.ts"],
      }),
      isBehind: (sha) => sha === "new",
    }),
    { frontend: false, backend: false },
  );
});

test("a deploy record names the deployed commit and its half, and skips GitHub's merge and status checks", () => {
  assert.deepEqual(deploymentRequest("backend", "abc123"), {
    ref: "abc123",
    environment: "production-release",
    task: "deploy:backend",
    auto_merge: false,
    required_contexts: [],
    // GitHub marks earlier deployments inactive on a success unless the
    // environment is a production one, which would erase the other half's
    // last success.
    production_environment: true,
    description: "Zipnami backend deployed to Cloudflare",
  });
});

test("a finished deploy keeps earlier records active and maps the job status to a deployment state", () => {
  assert.deepEqual(deploymentStatus("success"), {
    state: "success",
    auto_inactive: false,
  });
  assert.deepEqual(deploymentStatus("failure"), {
    state: "failure",
    auto_inactive: false,
  });
  // A cancelled deploy may have stopped halfway: never a success.
  assert.deepEqual(deploymentStatus("cancelled"), {
    state: "error",
    auto_inactive: false,
  });
});
