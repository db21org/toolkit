import { isNotDefined } from "@db21/toolkit/utils";

import { createLocalReasonRule } from "./local-reason-rule.mjs";

const TEST_RULE = "db21-tests/require-justification";
const TEST_MODULES = new Set(["vitest", "@jest/globals", "node:test"]);
const TEST_NAMES = new Set(["test", "it", "fit", "xit", "xtest"]);
const TEST_BUILDERS = new Set([
  "each",
  "for",
  "skipIf",
  "runIf",
  "extend",
  "scoped",
  "use",
]);

const getRoot = (node) => {
  if (node.type === "Identifier") {
    return node;
  }

  if (node.type === "MemberExpression") {
    return getRoot(node.object);
  }

  if (node.type === "CallExpression") {
    return getRoot(node.callee);
  }

  if (node.type === "TaggedTemplateExpression") {
    return getRoot(node.tag);
  }

  return null;
};

const getFirstMember = (node) => {
  if (node.type === "MemberExpression") {
    if (node.object.type === "Identifier") {
      return node.computed ? node.property.value : node.property.name;
    }

    return getFirstMember(node.object);
  }

  if (node.type === "CallExpression") {
    return getFirstMember(node.callee);
  }

  if (node.type === "TaggedTemplateExpression") {
    return getFirstMember(node.tag);
  }

  return null;
};

const isImportedTest = (definition, callee) => {
  if (definition.type !== "ImportBinding") {
    return false;
  }

  const declaration = definition.parent;

  if (!TEST_MODULES.has(declaration?.source?.value)) {
    return false;
  }

  const specifier = definition.node;

  if (specifier.type === "ImportNamespaceSpecifier") {
    return TEST_NAMES.has(getFirstMember(callee));
  }

  if (specifier.type === "ImportDefaultSpecifier") {
    return (
      declaration.source.value === "node:test" ||
      TEST_NAMES.has(getFirstMember(callee))
    );
  }

  return (
    specifier.type === "ImportSpecifier" &&
    TEST_NAMES.has(specifier.imported.name ?? specifier.imported.value)
  );
};

const isTestBinding = (identifier, callee, context) => {
  let scope = context.sourceCode.getScope(identifier);

  while (scope) {
    const variable = scope.set.get(identifier.name);

    if (variable) {
      const definition = variable.defs[0];

      if (!definition) {
        return TEST_NAMES.has(identifier.name);
      }

      return isImportedTest(definition, callee);
    }

    scope = scope.upper;
  }

  return (
    TEST_NAMES.has(identifier.name) &&
    /(?:^|[/\\])(?:tests?|__tests__)(?:[/\\])|\.(?:test|spec)\./u.test(
      context.filename,
    )
  );
};

const requireJustification = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      critical:
        "Assess test value before retaining it: concrete failure risk, observable contract, refactor resilience, distinct coverage, and appropriate tools. Retain, consolidate, remove, or defer; never mechanically add exceptions or mirror implementation. Retained tests require a local exception: -- Risk: <failure impact>; Contract: <observable guarantee>. Defer new React rendering tests until browser tooling is available. See @db21/toolkit/docs/test-policy.md.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Builders configure a test; their returned invocation declares it.
        if (node.callee.type === "MemberExpression") {
          const property = node.callee.computed
            ? node.callee.property.value
            : node.callee.property.name;

          if (TEST_BUILDERS.has(property)) {
            return;
          }
        }

        const root = getRoot(node.callee);

        if (root && isTestBinding(root, node.callee, context)) {
          // Single-line location keeps next-line exceptions local even for .each chains.
          context.report({ loc: root.loc, messageId: "critical" });
        }
      },
    };
  },
};

const minimumAssessmentLength = 10;

const isValidAssessment = (reason) => {
  const assessment = /^Risk:\s*(.+?);\s*Contract:\s*(.+)$/u.exec(reason.trim());

  if (isNotDefined(assessment)) {
    return false;
  }

  const [, risk, contract] = assessment;

  return (
    risk.trim().length >= minimumAssessmentLength &&
    contract.trim().length >= minimumAssessmentLength
  );
};

const requireLocalReason = createLocalReasonRule({
  rule: TEST_RULE,
  isValidReason: isValidAssessment,
  messages: {
    reason:
      "Test exceptions require eslint-disable-next-line or eslint-disable-line with -- Risk: <concrete failure impact>; Contract: <observable guarantee> (at least 10 characters each). Assess each test; do not bulk-rewrite justifications. Blanket exceptions are forbidden. See @db21/toolkit/docs/test-policy.md.",
    inline:
      "Inline ESLint configuration must not disable or downgrade the test justification rule; use a justified local exception for each critical test.",
  },
});

export const testPolicyPlugin = {
  rules: {
    "require-justification": requireJustification,
    "require-local-reason": requireLocalReason,
  },
};
