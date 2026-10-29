const transparentTypes = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

export const namedArraysPlugin = {
  rules: {
    "no-inline-member-access": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Require named arrays before accessing their members.",
        },
        schema: [],
        messages: {
          extract:
            "Extract this array literal into a meaningfully named constant before accessing its members. Comments do not exempt inline array member access. Keep initialization in the same evaluation scope to preserve behavior.",
        },
      },
      create(context) {
        return {
          MemberExpression(node) {
            let object = node.object;

            while (transparentTypes.has(object.type)) {
              object = object.expression;
            }

            if (object.type === "ArrayExpression") {
              context.report({ node, messageId: "extract" });
            }
          },
        };
      },
    },
  },
};
