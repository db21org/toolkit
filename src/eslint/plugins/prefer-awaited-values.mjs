const functionNodeTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

const getAwaitUsage = (sourceCode, node) => {
  let child = node;
  const ancestors = sourceCode.getAncestors(node).toReversed();

  for (const ancestor of ancestors) {
    if (functionNodeTypes.has(ancestor.type)) {
      return undefined;
    }

    if (ancestor.type === "ReturnStatement" && ancestor.argument === child) {
      return "return";
    }

    if (
      ["CallExpression", "NewExpression"].includes(ancestor.type) &&
      ancestor.arguments.includes(child)
    ) {
      return "argument";
    }

    child = ancestor;
  }

  return undefined;
};

const preferAwaitedValuesRule = {
  meta: {
    docs: {
      description:
        "Require awaited results to be assigned before function calls or returns.",
    },
    messages: {
      argument:
        "Assign the awaited result to a variable before passing it to a function or constructor.",
      return: "Assign the awaited result to a variable before returning it.",
    },
    schema: [],
    type: "suggestion",
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      AwaitExpression(node) {
        const usage = getAwaitUsage(sourceCode, node);

        if (!usage) {
          return;
        }

        context.report({ messageId: usage, node });
      },
    };
  },
};

export const preferAwaitedValuesPlugin = {
  rules: {
    "prefer-awaited-values": preferAwaitedValuesRule,
  },
};
