const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
const e2eDirectoryPattern = /(?:^|\/)(?:e2e|acceptance)\//;
const fixtureImportPattern = /(?:^|\/)fixtures(?:\/test)?(?:\.[cm]?[jt]sx?)?$/;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Import Playwright tests through the project fixture",
    },
    schema: [],
    messages: {
      directImport:
        "Import Playwright test APIs from the project E2E fixture instead of @playwright/test directly.",
    },
  },
  create(context) {
    let isE2eTest = false;

    return {
      Program(_node) {
        const filePath = context.getFilename().replaceAll("\\", "/");
        isE2eTest =
          e2eDirectoryPattern.test(filePath) && testFilePattern.test(filePath);
      },
      ImportDeclaration(node) {
        if (!isE2eTest) {
          return;
        }

        const importsTest = node.specifiers.some(
          (specifier) =>
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "test",
        );
        if (!importsTest) {
          return;
        }

        // acceptance/ can also hold a non-Playwright acceptance test (Issue
        // #3's dataset build has no screen to drive, so it runs under
        // Vitest). Its `test` import is unrelated to the Playwright fixture
        // this rule protects, so only a source that is actually trying to be
        // Playwright — either the fixture path or a direct @playwright/test
        // import — is in scope.
        const isFixtureImport = fixtureImportPattern.test(node.source.value);
        const isDirectPlaywrightImport =
          node.source.value === "@playwright/test";
        if (!isDirectPlaywrightImport && !isFixtureImport) {
          return;
        }

        if (isDirectPlaywrightImport) {
          context.report({ node, messageId: "directImport" });
        }
      },
    };
  },
};
