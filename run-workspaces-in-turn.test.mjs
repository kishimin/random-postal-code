import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Issue #125: the Coverage job ran every workspace's tests at once, so the
// frontend's browser tests competed with the backend's for the runner's CPU
// (the cause #116 found). bun's own --sequential output reads
// `<name>:<script>  |`, but the CI quality-gates acceptance test reads each
// package's coverage table from lines that start `<name> <script>:`.
const repositoryRoot = fileURLToPath(new URL("./", import.meta.url));
const runner = path.join(repositoryRoot, "run-workspaces-in-turn.mjs");

const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
};

// Each workspace script appends `start <name>` and `end <name>` to a shared
// log with a pause between them, so overlapping runs interleave the lines.
const recordingScript = (name, exitCode = 0) =>
  `node -e "const f=require('fs');f.appendFileSync('../../order.log','start ${name}\\n');setTimeout(()=>{f.appendFileSync('../../order.log','end ${name}\\n');console.log('out ${name}');console.error('err ${name}');process.exit(${exitCode})},300)"`;

const makeRepository = (packages) => {
  const root = mkdtempSync(path.join(tmpdir(), "zipnami-in-turn-"));
  writeJson(path.join(root, "package.json"), {
    name: "fixture",
    private: true,
    workspaces: ["packages/*"],
  });
  for (const { directory, name, scripts } of packages) {
    writeJson(path.join(root, "packages", directory, "package.json"), {
      name,
      scripts,
    });
  }
  return root;
};

const runIn = (root) =>
  spawnSync(process.execPath, [runner, "check"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  });

const orderLog = (root) =>
  readFileSync(path.join(root, "order.log"), "utf8").trim().split(/\r?\n/);

const workspace = (directory, scripts) => ({
  directory,
  name: `@fixture/${directory}`,
  scripts,
});

test("each workspace's script finishes before the next one starts", () => {
  const root = makeRepository([
    workspace("a", { check: recordingScript("a") }),
    workspace("b", { check: recordingScript("b") }),
  ]);
  try {
    const result = runIn(root);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(orderLog(root), ["start a", "end a", "start b", "end b"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every output line carries the `<name> <script>:` prefix the coverage acceptance test reads", () => {
  const root = makeRepository([
    workspace("a", { check: recordingScript("a") }),
  ]);
  try {
    const result = runIn(root);

    assert.match(result.stdout, /^@fixture\/a check: out a$/m);
    assert.match(result.stderr, /^@fixture\/a check: err a$/m);
    assert.match(result.stdout, /^@fixture\/a check: Exited with code 0$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("each workspace's start time and duration are in the log, so CI shows they did not overlap", () => {
  const root = makeRepository([
    workspace("a", { check: recordingScript("a") }),
  ]);
  try {
    const result = runIn(root);

    assert.match(
      result.stdout,
      /^@fixture\/a check: Started at \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/m,
    );
    assert.match(result.stdout, /^@fixture\/a check: Finished in \d+\.\d{2}s$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failing workspace does not stop the ones after it, and the run fails with the first failure's code", () => {
  const root = makeRepository([
    workspace("a", { check: recordingScript("a", 3) }),
    workspace("b", { check: recordingScript("b", 5) }),
  ]);
  try {
    const result = runIn(root);

    assert.equal(result.status, 3);
    assert.deepEqual(orderLog(root), ["start a", "end a", "start b", "end b"]);
    assert.match(result.stdout, /^@fixture\/a check: Exited with code 3$/m);
    // The workspace after the failure still reports, as its coverage must.
    assert.match(result.stdout, /^@fixture\/b check: out b$/m);
    assert.match(result.stdout, /^@fixture\/b check: Exited with code 5$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a run in which no workspace has the script fails rather than passing the gate", () => {
  const root = makeRepository([workspace("a", {})]);
  try {
    const result = runIn(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no workspace has a "check" script/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a workspace without the script is skipped", () => {
  const root = makeRepository([
    workspace("a", {}),
    workspace("b", { check: recordingScript("b") }),
  ]);
  try {
    const result = runIn(root);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(orderLog(root), ["start b", "end b"]);
    assert.doesNotMatch(result.stdout, /@fixture\/a/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the PR coverage gate runs workspaces in turn", () => {
  const { scripts } = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  );

  assert.equal(
    scripts["test:coverage:pr"],
    "node run-workspaces-in-turn.mjs test:coverage:pr",
  );
});
