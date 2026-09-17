const preferNamedExportsInUtils = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer named exports in utility files",
    },
    schema: [],
    messages: {
      namedExport: "Use named exports in utility files.",
    },
  },
  create: (context) => ({
    ExportDefaultDeclaration: (node) => {
      const filePath = context.getFilename().replaceAll("\\", "/");
      if (/(^|\/)utils\//.test(filePath)) {
        context.report({ node, messageId: "namedExport" });
      }
    },
  }),
};

export default preferNamedExportsInUtils;
