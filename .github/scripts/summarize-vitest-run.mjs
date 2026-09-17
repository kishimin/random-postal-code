import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RESULT_FILE = "test-result.json";
const COVERAGE_FILE = path.join("coverage", "coverage-summary.json");
const WORKSPACE_ROOTS = ["apps", "packages"];
const DOWNLOADED_RESULTS_DIRECTORY = "results";
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
]);

const readJson = (filePath) =>
  existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf8")) : undefined;

/** Finds every directory under `root` that holds a Vitest result file. */
const findResultDirectories = (root) => {
  if (!existsSync(root)) return [];

  const found = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (existsSync(path.join(current, RESULT_FILE))) found.push(current);

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
        pending.push(path.join(current, entry.name));
      }
    }
  }

  return found.sort();
};

const testRows = (result) => [
  ["Suites", `${result.numPassedTestSuites}/${result.numTotalTestSuites}`],
  ["Tests", `${result.numPassedTests}/${result.numTotalTests}`],
  ["Failed", `${result.numFailedTests}`],
  ["Pending", `${result.numPendingTests}`],
];

const coverageRows = ({ total }) =>
  ["lines", "statements", "functions", "branches"].map((metric) => [
    metric,
    `${total[metric].pct}% (${total[metric].covered}/${total[metric].total})`,
  ]);

const asTable = (heading, rows) => [
  [
    { data: heading, header: true },
    { data: "Value", header: true },
  ],
  ...rows,
];

const appendPackage = (core, label, directory) => {
  const result = readJson(path.join(directory, RESULT_FILE));
  const coverage = readJson(path.join(directory, COVERAGE_FILE));

  core.summary.addHeading(label, 4);
  core.summary.addRaw(
    result.success ? "All tests passed." : "Some tests failed.",
    true,
  );

  if (result.numTotalTests === 0) {
    // Not treated as a failure here. An empty suite is caught by the coverage
    // threshold, which cannot be satisfied without tests.
    core.summary.addRaw("No test cases ran.", true);
  }

  core.summary.addTable(asTable("Metric", testRows(result)));

  if (coverage) {
    core.summary.addTable(asTable("Coverage", coverageRows(coverage)));
  }
};

const summarize = async (core, sizes, rootFor, labelFor) => {
  core.summary.addHeading("Test results", 2);

  for (const size of sizes) {
    core.summary.addHeading(size, 3);

    const directories = rootFor(size).flatMap(findResultDirectories);
    if (directories.length === 0) {
      // A missing file means the run never produced results — the job that was
      // supposed to write them failed or was skipped. Reported rather than
      // thrown: the failing job is where that belongs.
      core.summary.addRaw(`No test results were produced for ${size}.`, true);
      continue;
    }

    for (const directory of directories) {
      appendPackage(core, labelFor(size, directory), directory);
    }
  }

  await core.summary.write();
};

/** Summarizes the runs the current job just produced across every package. */
export const summarizeVitestRun = async ({ core, sizes }) =>
  summarize(
    core,
    sizes,
    () => WORKSPACE_ROOTS,
    (_size, directory) => directory.replaceAll("\\", "/"),
  );

/**
 * Summarizes runs produced by other jobs and downloaded as one artifact per
 * size, each preserving the workspace paths it was uploaded with.
 */
export const summarizeDownloadedRuns = async ({ core, sizes }) =>
  summarize(
    core,
    sizes,
    (size) => [path.join(DOWNLOADED_RESULTS_DIRECTORY, `${size}-test-results`)],
    (size, directory) =>
      path
        .relative(
          path.join(DOWNLOADED_RESULTS_DIRECTORY, `${size}-test-results`),
          directory,
        )
        .replaceAll("\\", "/") || "(root)",
  );
