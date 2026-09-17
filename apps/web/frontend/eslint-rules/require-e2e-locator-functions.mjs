const locatorMethods = new Set([
  "getByRole",
  "getByLabel",
  "getByText",
  "getByPlaceholder",
]);

export default {
  meta: {
    type: "problem",
    docs: { description: "Define E2E locators in functions" },
    schema: [],
    messages: {
      locator:
        "Define Playwright locators in a dedicated function in the Page Object.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier" ||
          !locatorMethods.has(node.callee.property.name)
        ) {
          return;
        }

        const ancestors = context.sourceCode.getAncestors(node);
        const isLocatorFunction = ancestors.some(
          (ancestor) => ancestor.type === "ArrowFunctionExpression",
        );
        if (!isLocatorFunction) {
          context.report({ node, messageId: "locator" });
        }
      },
    };
  },
};
