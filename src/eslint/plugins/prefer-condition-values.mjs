const functionTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);

const conditionTypes = new Set([
  "IfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForStatement",
  "ConditionalExpression",
]);

const transparentTypes = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const isInlineCallback = (argument) => {
  let value = argument;

  while (transparentTypes.has(value.type)) {
    value = value.expression;
  }

  return functionTypes.has(value.type);
};

const isInCondition = (node) => {
  let child = node;

  for (let parent = node.parent; parent; parent = parent.parent) {
    if (functionTypes.has(parent.type)) {
      return false;
    }

    if (conditionTypes.has(parent.type) && parent.test === child) {
      return true;
    }

    if (parent.type === "SwitchStatement" && parent.discriminant === child) {
      return true;
    }

    child = parent;
  }

  return false;
};

export const preferConditionValuesPlugin = {
  rules: {
    "prefer-named-values": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Require inline-callback computations to be named before conditions.",
        },
        schema: [],
        messages: {
          extract:
            "Assign this inline-callback computation to a meaningfully named constant before using it in a condition. Preserve short-circuit behavior and evaluation frequency; loop conditions must be recomputed on each check.",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              !node.arguments.some(isInlineCallback) ||
              !isInCondition(node)
            ) {
              return;
            }

            context.report({ node, messageId: "extract" });
          },
        };
      },
    },
  },
};
