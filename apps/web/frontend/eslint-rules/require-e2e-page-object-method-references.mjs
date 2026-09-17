const isPageObjectFactory = (node) =>
  node.type === "VariableDeclarator" &&
  node.id.type === "Identifier" &&
  node.id.name.endsWith("Page") &&
  node.init?.type === "ArrowFunctionExpression";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Page Object methods to be defined before the returned object",
    },
    schema: [],
    messages: {
      method:
        "Define Page Object methods before the returned object and return the function reference.",
    },
  },
  create(context) {
    return {
      ReturnStatement(node) {
        if (node.argument?.type !== "ObjectExpression") {
          return;
        }

        const ancestors = context.sourceCode.getAncestors(node);
        const factory = ancestors.find(isPageObjectFactory);
        if (!factory) {
          return;
        }

        for (const property of node.argument.properties) {
          if (
            property.type === "Property" &&
            (property.value.type === "ArrowFunctionExpression" ||
              property.value.type === "FunctionExpression")
          ) {
            context.report({ node: property, messageId: "method" });
          }
        }
      },
    };
  },
};
