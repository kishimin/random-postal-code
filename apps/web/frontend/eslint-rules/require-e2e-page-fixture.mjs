const e2eDirectoryPattern = /(?:^|\/)(?:e2e|acceptance)\//;
const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;

// acceptance/ can also hold a non-Playwright acceptance test (Issue #3's
// dataset build has no screen to drive, so it runs under Vitest). Its
// `test(...)` calls never receive a Playwright Page Object fixture and are
// not this rule's concern. A RuleTester fragment has no import at all, and
// that case must keep reporting as before, so this only opts a file out when
// it positively imports `test` from vitest rather than requiring proof that
// it is Playwright.
const importsVitestTest = (programNode) =>
  programNode.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === "vitest" &&
      statement.specifiers.some(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === "test",
      ),
  );

const isTestCall = (node) =>
  node.callee.type === "Identifier" && node.callee.name === "test";

const isSkippedCall = (node) =>
  node.callee.type === "MemberExpression" &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "test" &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === "skip";

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require Page Object fixtures in implemented E2E tests",
    },
    schema: [],
    messages: {
      pageFixture:
        "Receive a Page Object fixture in implemented E2E tests; keep browser operations out of the test body.",
    },
  },
  create(context) {
    const filePath = context.getFilename().replaceAll("\\", "/");
    const isE2eTest =
      e2eDirectoryPattern.test(filePath) && testFilePattern.test(filePath);
    let isPlaywrightTest = true;

    return {
      Program(node) {
        if (isE2eTest) {
          isPlaywrightTest = !importsVitestTest(node);
        }
      },
      CallExpression(node) {
        if (
          !isE2eTest ||
          !isPlaywrightTest ||
          !isTestCall(node) ||
          isSkippedCall(node)
        ) {
          return;
        }

        const callback = node.arguments.at(-1);
        if (
          callback?.type !== "ArrowFunctionExpression" ||
          callback.params[0]?.type !== "ObjectPattern"
        ) {
          context.report({ node, messageId: "pageFixture" });
          return;
        }

        const hasPageFixture = callback.params[0].properties.some(
          (property) =>
            property.type === "Property" &&
            property.key.type === "Identifier" &&
            property.key.name.endsWith("Page"),
        );
        if (!hasPageFixture) {
          context.report({ node, messageId: "pageFixture" });
        }
      },
    };
  },
};
