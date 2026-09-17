const e2eDirectoryPattern = /(?:^|\/)e2e\//;
const testFilePattern = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;

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

    return {
      CallExpression(node) {
        if (!isE2eTest || !isTestCall(node) || isSkippedCall(node)) {
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
