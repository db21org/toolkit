import { isEmpty } from "@db21/toolkit/utils";

import { createLocalReasonRule } from "./local-reason-rule.mjs";
import { rawSqlGuardProcessor } from "./raw-sql-guard.mjs";

const SQL_RULE = "db21-sql/require-justification";
const minimumReasonLength = 20;
const fragmentPathLength = 2;
const prismaSqlMethods = new Set(["sql", "raw"]);
const transparentExpressions = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
]);

const RAW_METHODS = new Set([
  "$queryRaw",
  "$executeRaw",
  "$queryRawUnsafe",
  "$executeRawUnsafe",
]);
const KYSELY_ESCAPE_HATCHES = new Set(["raw", "lit", "ref", "id"]);

const unwrap = (node) => {
  if (transparentExpressions.has(node.type)) {
    return unwrap(node.expression);
  }

  return node;
};

const memberName = (node) => {
  if (!node.computed) {
    return node.property.name;
  }

  if (node.property.type === "Literal") {
    return node.property.value;
  }

  if (
    node.property.type === "TemplateLiteral" &&
    isEmpty(node.property.expressions)
  ) {
    return node.property.quasis[0].value.cooked;
  }

  return null;
};

const importedPath = (expression, context) => {
  const node = unwrap(expression);

  if (node.type === "MemberExpression") {
    const parent = importedPath(node.object, context);

    return parent && { ...parent, path: [...parent.path, memberName(node)] };
  }

  if (node.type !== "Identifier") {
    return null;
  }

  let scope = context.sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get(node.name);

    if (variable) {
      const definition = variable.defs[0];

      if (definition?.type !== "ImportBinding") {
        return null;
      }

      const source = definition.parent?.source?.value;
      const specifier = definition.node;

      if (specifier.type === "ImportSpecifier") {
        return {
          source,
          path: [specifier.imported.name ?? specifier.imported.value],
        };
      }

      if (specifier.type === "ImportNamespaceSpecifier") {
        return { source, path: [] };
      }

      return null;
    }

    scope = scope.upper;
  }

  return null;
};

const isSqlFragment = (expression, context) => {
  const imported = importedPath(expression, context);

  if (!imported) {
    return false;
  }

  const { source, path } = imported;

  // Named Prisma re-exports from workspace database packages retain this API.
  if (path[0] === "Prisma") {
    return path.length === fragmentPathLength && prismaSqlMethods.has(path[1]);
  }

  if (source !== "kysely" || path[0] !== "sql") {
    return false;
  }

  return (
    path.length === 1 ||
    (path.length === fragmentPathLength && KYSELY_ESCAPE_HATCHES.has(path[1]))
  );
};

const requireJustification = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      raw: "Prefer ORM queries or a typed query builder. Justify required raw SQL with eslint-disable-next-line db21-sql/require-justification -- <why ORM/builder cannot preserve behavior>.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (
          (callee.type === "MemberExpression" &&
            RAW_METHODS.has(memberName(callee))) ||
          isSqlFragment(callee, context)
        ) {
          context.report({ node: node.callee, messageId: "raw" });
        }
      },
      TaggedTemplateExpression(node) {
        const tag = unwrap(node.tag);

        if (
          (tag.type === "MemberExpression" &&
            RAW_METHODS.has(memberName(tag))) ||
          isSqlFragment(tag, context)
        ) {
          context.report({ node: node.tag, messageId: "raw" });
        }
      },
    };
  },
};

const requireLocalReason = createLocalReasonRule({
  rule: SQL_RULE,
  isValidReason: (reason) => reason.trim().length >= minimumReasonLength,
  messages: {
    reason:
      "Raw SQL exceptions must use eslint-disable-next-line or eslint-disable-line with a -- explanation of at least 20 characters; blanket exceptions are forbidden.",
    inline:
      "Inline ESLint configuration must not disable or downgrade raw SQL justification; use a justified local exception for each operation or fragment.",
  },
});

export const rawSqlPolicyPlugin = {
  processors: { "policy-guard": rawSqlGuardProcessor },
  rules: {
    "require-justification": requireJustification,
    "require-local-reason": requireLocalReason,
  },
};
