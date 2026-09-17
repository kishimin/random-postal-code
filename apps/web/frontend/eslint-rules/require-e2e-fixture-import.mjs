const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
const e2eDirectoryPattern = /(?:^|\/)e2e\//;
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
        if (
          importsTest &&
          (node.source.value === "@playwright/test" ||
            !fixtureImportPattern.test(node.source.value))
        ) {
          context.report({ node, messageId: "directImport" });
        }
      },
    };
  },
};
