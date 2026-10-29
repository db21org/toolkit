import { isEmpty } from "@db21/toolkit/utils";

import { createLocalReasonRule } from "./local-reason-rule.mjs";

const RULE = "db21-promises/prefer-native-batch";
const minimumReasonLength = 20;
const transparentExpressions = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
]);

const unwrap = (node) =>
  transparentExpressions.has(node.type) ? unwrap(node.expression) : node;

const isGlobalPromise = (node, context) => {
  if (node.type !== "Identifier" || node.name !== "Promise") {
    return false;
  }

  let scope = context.sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get("Promise");

    if (variable) {
      return isEmpty(variable.defs);
    }

    scope = scope.upper;
  }

  return true;
};

const isAll = (node) => {
  if (!node.computed) {
    return node.property.name === "all";
  }

  if (node.property.type === "Literal") {
    return node.property.value === "all";
  }

  return (
    node.property.type === "TemplateLiteral" &&
    isEmpty(node.property.expressions) &&
    node.property.quasis[0].value.cooked === "all"
  );
};

const preferNativeBatch = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      batch:
        "Prefer a native batch operation or refactor the owning method to support bulk work instead of await Promise.all(...). Do not blindly serialize independent work or hide Promise.all in a wrapper. If concurrency is necessary, use eslint-disable-next-line db21-promises/prefer-native-batch -- <why native batching cannot preserve the required behavior>.",
    },
  },
  create(context) {
    return {
      AwaitExpression(node) {
        const call = unwrap(node.argument);

        if (call.type !== "CallExpression") {
          return;
        }

        const callee = unwrap(call.callee);

        if (
          callee.type === "MemberExpression" &&
          isAll(callee) &&
          isGlobalPromise(unwrap(callee.object), context)
        ) {
          context.report({ node, messageId: "batch" });
        }
      },
    };
  },
};

const requireLocalReason = createLocalReasonRule({
  rule: RULE,
  isValidReason: (reason) => reason.trim().length >= minimumReasonLength,
  messages: {
    reason:
      "Promise.all exceptions require eslint-disable-next-line or eslint-disable-line with a -- explanation of at least 20 characters stating why native batching is unsuitable; blanket exceptions are forbidden.",
    inline:
      "Do not disable or downgrade native batch policy through inline configuration; justify each necessary await Promise.all locally.",
  },
});

export const promiseAllPolicyPlugin = {
  rules: {
    "prefer-native-batch": preferNativeBatch,
    "require-local-reason": requireLocalReason,
  },
};
