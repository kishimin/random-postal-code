const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
const e2eDirectoryPattern = /(?:^|\/)e2e\//;
const allowedDirectoryPattern = /(?:^|\/)e2e\/(?:tests|specs)\//;

export default {
  meta: {
    type: "problem",
    docs: { description: "Keep Playwright tests under e2e/tests or e2e/specs" },
    schema: [],
    messages: {
      directory: "Place Playwright test files under e2e/tests or e2e/specs.",
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
