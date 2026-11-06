const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
// Acceptance tests are browser tests too, so the same Page Object conventions
// apply to them. They sit directly under acceptance/ rather than in a tests
// subdirectory, because that path is what the ATDD guard protects.
// e2e/production holds the tests that run only against the deployed site
// (Issue #104). They stay out of e2e/tests so the Medium runner, which
// matches that directory, never starts them against a local preview.
const e2eDirectoryPattern = /(?:^|\/)(?:e2e|acceptance)\//;
const allowedDirectoryPattern =
  /(?:^|\/)(?:e2e\/(?:tests|specs|production)|acceptance)\//;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Keep Playwright tests under e2e/tests, e2e/specs, or e2e/production",
    },
    schema: [],
    messages: {
      directory:
        "Place Playwright test files under e2e/tests, e2e/specs, or e2e/production.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const filePath = context.getFilename().replaceAll("\\", "/");
        if (
          testFilePattern.test(filePath) &&
          e2eDirectoryPattern.test(filePath)
        ) {
          if (!allowedDirectoryPattern.test(filePath)) {
            context.report({ node, messageId: "directory" });
          }
        }
      },
    };
  },
};
