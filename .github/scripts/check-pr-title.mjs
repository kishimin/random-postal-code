// Fails a pull request whose title is not a Conventional Commit (Issue #133).
// Squash merges make the title the commit subject on main, and release-please
// reads those subjects to choose the next version and write CHANGELOG.md, so a
// title it cannot parse is a change that never reaches the changelog.
// ci-pull-request.yml runs this file with the title in PR_TITLE.
import { pathToFileURL } from "node:url";

export const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "test",
  "build",
  "ci",
  "chore",
  "style",
  "revert",
];

// A scope may not be empty or contain spaces: release-please would read
// "fix(): x" and "fix(a b): x" as having no type at all.
const TITLE_PATTERN = new RegExp(
  `^(?:${CONVENTIONAL_TYPES.join("|")})(?:\\([^()\\s]+\\))?!?: +\\S`,
);

export const isConventionalTitle = (title) => TITLE_PATTERN.test(title);

const main = () => {
  const title = process.env.PR_TITLE ?? "";
  // The title is quoted and never starts the line, so a title that looks like
  // a workflow command ("::set-output ...") is printed, not executed.
  if (isConventionalTitle(title)) {
    console.log(`The title is a Conventional Commit: ${JSON.stringify(title)}`);
    return;
  }
  console.error(
    [
      `::error::The pull request title is not a Conventional Commit: ${JSON.stringify(title)}`,
      `Start it with one of ${CONVENTIONAL_TYPES.join(", ")}, optionally followed by a (scope) and !, then ": " and a description.`,
      `For example "fix(web): keep the history after a reload". The squash merge uses the title as the commit subject on main, and release-please versions releases from those subjects.`,
    ].join("\n"),
  );
  process.exitCode = 1;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
