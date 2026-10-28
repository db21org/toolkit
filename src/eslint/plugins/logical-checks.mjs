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
            "Logical expression has {{count}} checks; maximum is 3. Refactor into readable, focused checks, preferably separate guards with early returns where appropriate. Preserve evaluation order, short-circuit behavior and returned values; do not hide complexity in trivial wrappers.",
        },
      },
      create(context) {
        return {
          LogicalExpression(node) {
            if (hasLogicalParent(node)) {
              return;
            }

            const count = countChecks(node);

            if (count > 3) {
              context.report({
                node,
                messageId: "excessive",
                data: { count },
              });
            }
          },
        };
      },
    },
  },
};
