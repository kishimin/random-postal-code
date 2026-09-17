import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FRONTEND_DIRECTORY = "apps/web/frontend";
const DOWNLOADED_RESULTS_DIRECTORY = "results";
const DOWNLOADED_COVERAGE_DIRECTORY = "coverage-reports";

const readJson = (filePath) =>
  existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf8")) : undefined;

const localLocations = () => ({
  result: path.join(FRONTEND_DIRECTORY, "test-result.json"),
  coverage: path.join(FRONTEND_DIRECTORY, "coverage", "coverage-summary.json"),
});

// actions/download-artifact places each artifact in a directory named after it.
const downloadedLocations = (size) => ({
  result: path.join(
    DOWNLOADED_RESULTS_DIRECTORY,
    `frontend-${size}-test-results`,
    "test-result.json",
  ),
  coverage: path.join(
    DOWNLOADED_COVERAGE_DIRECTORY,
    `frontend-${size}-coverage-report`,
    "coverage-summary.json",
  ),
});

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

const appendSection = (core, size, { result, coverage }) => {
  core.summary.addHeading(size, 3);

  if (!result) {
    // A missing file means the run never produced results — the job that was
    // supposed to write them failed or was skipped. Reported rather than
    // thrown: the failing job is where that belongs.
    core.summary.addRaw(`No test results were produced for ${size}.`, true);
    return;
  }

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

const summarize = async (core, sizes, locationsFor) => {
  core.summary.addHeading("Frontend test results", 2);

  for (const size of sizes) {
    const { result, coverage } = locationsFor(size);
    appendSection(core, size, {
      result: readJson(result),
      coverage: readJson(coverage),
    });
  }

  await core.summary.write();
};

/** Summarizes the Vitest run the current job just produced. */
export const summarizeVitestRun = async ({ core, sizes }) =>
  summarize(core, sizes, localLocations);

/** Summarizes Vitest runs produced by other jobs and downloaded as artifacts. */
export const summarizeDownloadedRuns = async ({ core, sizes }) =>
  summarize(core, sizes, downloadedLocations);
