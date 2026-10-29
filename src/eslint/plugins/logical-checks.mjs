const transparentTypes = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const isTransparent = (node) =>
  transparentTypes.has(node.type) ||
  (node.type === "UnaryExpression" && node.operator === "!");

const countChecks = (node) => {
  if (isTransparent(node)) {
    return countChecks(node.expression ?? node.argument);
  }

  if (node.type === "LogicalExpression") {
    return countChecks(node.left) + countChecks(node.right);
  }

  return 1;
};

const hasLogicalParent = (node) => {
  let parent = node.parent;

  while (parent && isTransparent(parent)) {
    parent = parent.parent;
  }

  return parent?.type === "LogicalExpression";
};

export const logicalChecksPlugin = {
  rules: {
    "max-checks": {
      meta: {
        type: "suggestion",
        docs: { description: "Keep logical expressions readable and focused." },
        schema: [],
        messages: {
          excessive:
            "Logical expression has {{count}} checks and {{length}} characters; maximum is 3 checks and 120 characters. Refactor into readable, focused checks, preferably separate guards with early returns where appropriate. Preserve evaluation order, short-circuit behavior and returned values; do not hide complexity in trivial wrappers.",
        },
      },
      create(context) {
        return {
          LogicalExpression(node) {
            if (hasLogicalParent(node)) {
              return;
            }

            const count = countChecks(node);
            const length = context.sourceCode
              .getTokens(node)
              .reduce(
                (total, token) => total + token.range[1] - token.range[0],
                0,
              );

            if (count > 3 || length > 120) {
              context.report({
                node,
                messageId: "excessive",
                data: { count, length },
              });
            }
          },
        };
      },
    },
  },
};
