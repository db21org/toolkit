const hookNamePattern = /^use[A-Z\d]/u;
const functionNodeTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
]);
const testFilenamePattern = /\.(?:spec|test)\.tsx$/u;

const reportHook = (context, node, name) => {
  context.report({
    data: { name },
    messageId: "extractHook",
    node,
  });
};

const requireExtractedHooksRule = {
  meta: {
    docs: {
      description:
        "Require custom hooks declared in React component files to live in dedicated hook modules.",
    },
    messages: {
      extractHook:
        'Move custom hook "{{name}}" from this component file to a dedicated hooks/use-*.hook.ts module.',
    },
    schema: [],
    type: "suggestion",
  },
  create(context) {
    const normalizedFilename = context.filename.replaceAll("\\", "/");

    if (
      !normalizedFilename.endsWith(".tsx") ||
      normalizedFilename.includes("/generated/")
    ) {
      return {};
    }

    if (
      normalizedFilename.includes("/test/") ||
      testFilenamePattern.test(normalizedFilename)
    ) {
      return {};
    }

    return {
      FunctionDeclaration(node) {
        if (node.id && hookNamePattern.test(node.id.name)) {
          reportHook(context, node.id, node.id.name);
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          hookNamePattern.test(node.id.name) &&
          functionNodeTypes.has(node.init?.type)
        ) {
          reportHook(context, node.id, node.id.name);
        }
      },
    };
  },
};

export const requireExtractedHooksPlugin = {
  rules: { "require-extracted-hooks": requireExtractedHooksRule },
};
