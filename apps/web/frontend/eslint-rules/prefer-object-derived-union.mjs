const message =
  "Define string values in an `as const` object and derive the union type from its values.";

const isStringLiteral = (member) =>
  member.type === "TSLiteralType" && typeof member.literal?.value === "string";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require string literal unions to be derived from const definitions.",
    },
    schema: [],
    messages: { preferObjectDerivedUnion: message },
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        const typeAnnotation = node.typeAnnotation;

        if (
          typeAnnotation.type !== "TSUnionType" ||
          !typeAnnotation.types.every(isStringLiteral)
        ) {
          return;
        }

        context.report({
          node: typeAnnotation,
          messageId: "preferObjectDerivedUnion",
        });
      },
    };
  },
};
