const maximumPropsKeys = 5;

const isPropsTypeName = (name) => name.endsWith("Props");

const limitPropsKeys = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Limit component Props definitions to five keys",
    },
    schema: [],
    messages: {
      tooManyKeys: "Keep Props definitions to five keys or fewer.",
    },
  },
  create: (context) => {
    const reportIfTooMany = (node, name, members) => {
      if (isPropsTypeName(name) && members.length > maximumPropsKeys) {
        context.report({ node, messageId: "tooManyKeys" });
      }
    };

    return {
      TSTypeAliasDeclaration: (node) => {
        if (node.typeAnnotation.type === "TSTypeLiteral") {
          reportIfTooMany(
            node.typeAnnotation,
            node.id.name,
            node.typeAnnotation.members,
          );
        }
      },
      TSInterfaceDeclaration: (node) => {
        reportIfTooMany(node.body, node.id.name, node.body.body);
      },
    };
  },
};

export default limitPropsKeys;
