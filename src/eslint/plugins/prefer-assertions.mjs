const getSingleThrow = (statement) => {
  if (statement.type === "ThrowStatement") {
    return statement;
  }

  if (
    statement.type === "BlockStatement" &&
    statement.body.length === 1 &&
    statement.body[0]?.type === "ThrowStatement"
  ) {
    return statement.body[0];
  }

  return undefined;
};

const getAssertionName = (condition) => {
  if (
    condition.type === "CallExpression" &&
    condition.callee.type === "Identifier"
  ) {
    if (condition.callee.name === "isDefined") {
      return "notDefined";
    }

    if (condition.callee.name === "isNotDefined") {
      return "defined";
    }
  }

  return condition.type === "UnaryExpression" && condition.operator === "!"
    ? "true"
    : "false";
};

const getPresenceAssertionName = (assertionName, predicateName) => {
  const expectsPredicateResult = assertionName === "true";
  const predicateIsPositive = predicateName === "isDefined";

  return expectsPredicateResult === predicateIsPositive
    ? "defined"
    : "notDefined";
};

const preferAssertionsRule = {
  meta: {
    docs: {
      description:
        "Require shared assertion helpers instead of if statements that only throw.",
    },
    schema: [],
    type: "suggestion",
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.object.type !== "Identifier" ||
          node.callee.object.name !== "assert"
        ) {
          return;
        }

        if (
          node.callee.property.type !== "Identifier" ||
          !["false", "true"].includes(node.callee.property.name)
        ) {
          return;
        }

        if (node.arguments[0]?.type !== "CallExpression") {
          return;
        }

        if (
          node.arguments[0].callee.type !== "Identifier" ||
          !["isDefined", "isNotDefined"].includes(node.arguments[0].callee.name)
        ) {
          return;
        }

        const assertionName = getPresenceAssertionName(
          node.callee.property.name,
          node.arguments[0].callee.name,
        );

        context.report({
          message: `Use assert.${assertionName}(value, errorOrMessage) instead of wrapping a shared presence predicate in a boolean assertion.`,
          node,
        });
      },
      IfStatement(node) {
        if (node.alternate || !getSingleThrow(node.consequent)) {
          return;
        }

        const assertionName = getAssertionName(node.test);

        context.report({
          message: `Use assert.${assertionName}(condition, errorOrMessage) from @db21/toolkit/utils instead of an if statement that only throws.`,
          node,
        });
      },
    };
  },
};

export const preferAssertionsPlugin = {
  rules: {
    "prefer-assertions": preferAssertionsRule,
  },
};
