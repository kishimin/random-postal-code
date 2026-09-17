const blockedMethods = new Set([
  "click",
  "fill",
  "getByLabel",
  "getByPlaceholder",
  "getByRole",
  "getByText",
  "getByTestId",
  "goto",
  "locator",
  "press",
  "selectOption",
  "setInputFiles",
]);
const e2eDirectoryPattern = /(?:^|\/)e2e\//;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Keep browser operations inside E2E Page Objects",
    },
    schema: [],
    messages: {
      rawOperation:
        "Keep page interactions in a Page Object and expose it through a Playwright fixture.",
    },
  },
  create(context) {
    const filePath = context.getFilename().replaceAll("\\", "/");
    const isE2eTest =
      e2eDirectoryPattern.test(filePath) &&
      /(?:\.test|\.spec)\./.test(filePath);

    return {
      MemberExpression(node) {
        if (
          isE2eTest &&
          node.object.type === "Identifier" &&
          node.object.name === "page" &&
          node.property.type === "Identifier" &&
          blockedMethods.has(node.property.name)
        ) {
          context.report({ node, messageId: "rawOperation" });
        }
      },
    };
  },
};
