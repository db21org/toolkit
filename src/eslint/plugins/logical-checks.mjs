const transparentTypes = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);
const MAX_LOGICAL_CHECKS = 3;
const MAX_LOGICAL_EXPRESSION_CHARACTERS = 120;

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
        docs: {
          description:
            "Keep logical expressions readable and avoid lone nested if statements.",
        },
        schema: [],
        messages: {
          excessive:
            "Logical expression has {{count}} checks and {{length}} characters; maximum is 3 checks and 120 characters. Refactor into readable, focused checks, preferably separate guards with early returns where appropriate. Preserve evaluation order, short-circuit behavior and returned values; do not hide complexity in trivial wrappers.",
          loneNestedIf:
            "Do not nest an if statement as the only statement inside another if. Prefer extracting both conditions into named boolean constants before a single if and combining them with &&. Preserve evaluation order and short-circuit behavior; guard dependent checks with the first boolean when necessary.",
        },
      },
      create(context) {
        return {
          IfStatement(node) {
            if (node.alternate) {
              return;
            }

            const consequent = node.consequent;
            const inner =
              consequent.type === "BlockStatement" &&
              consequent.body.length === 1
                ? consequent.body[0]
                : consequent;

            if (inner.type === "IfStatement" && !inner.alternate) {
              context.report({ node, messageId: "loneNestedIf" });
            }
          },
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

            if (
              count > MAX_LOGICAL_CHECKS ||
              length > MAX_LOGICAL_EXPRESSION_CHARACTERS
            ) {
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
