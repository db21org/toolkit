const TEST_RULE = "db21-tests/require-justification";
const TEST_MODULES = new Set(["vitest", "@jest/globals", "node:test"]);
const TEST_NAMES = new Set(["test", "it", "fit", "xit", "xtest"]);

const isInlineDowngrade = (comment) => {
  if (comment.type !== "Block") {
    return false;
  }

  const directive = /^\s*eslint\s+([^]*?)(?:\s+--\s[^]*)?\s*$/u.exec(
    comment.value,
  );

  if (!directive) {
    return false;
  }

  const setting =
    /(?:^|[,{])\s*["']?db21-tests\/require-justification["']?\s*:\s*(?:\[\s*)?(?:"([^"]*)"|'([^']*)'|([^\s,\]}]+))/u.exec(
      directive[1],
    );

  if (!setting) {
    return false;
  }

  const severity = setting[1] ?? setting[2] ?? setting[3];

  return severity !== "error" && Number(severity) !== 2;
};

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

  if (
    specifier.type === "ImportNamespaceSpecifier" ||
    (specifier.type === "ImportDefaultSpecifier" &&
      declaration.source.value !== "node:test")
  ) {
    return TEST_NAMES.has(getFirstMember(callee));
  }

  return (
    specifier.type === "ImportDefaultSpecifier" ||
    (specifier.type === "ImportSpecifier" &&
      TEST_NAMES.has(specifier.imported.name ?? specifier.imported.value))
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
        "Remove unnecessary test or justify critical behavior with eslint-disable-next-line db21-tests/require-justification -- <specific risk or regression>.",
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

          if (
            [
              "each",
              "for",
              "skipIf",
              "runIf",
              "extend",
              "scoped",
              "use",
            ].includes(property)
          ) {
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

const requireLocalReason = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      reason:
        "Test exceptions must use eslint-disable-next-line or eslint-disable-line with a -- explanation of the specific risk or regression; blanket test exceptions are forbidden.",
      inline:
        "Inline ESLint configuration must not disable or downgrade the test justification rule; use a justified local exception for each critical test.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isInlineDowngrade(comment)) {
            context.report({ loc: comment.loc, messageId: "inline" });
            continue;
          }

          const match =
            /^\s*(eslint-disable(?:-next-line|-line)?)\s+([^]*?)\s*$/u.exec(
              comment.value,
            );

          if (!match) {
            continue;
          }

          const [rules, reason = ""] = match[2].split(/\s+--\s*/u);

          if (!rules.split(/\s*,\s*/u).includes(TEST_RULE)) {
            continue;
          }

          if (match[1] === "eslint-disable" || reason.trim().length < 20) {
            context.report({ loc: comment.loc, messageId: "reason" });
          }
        }
      },
    };
  },
};

export const testPolicyPlugin = {
  rules: {
    "require-justification": requireJustification,
    "require-local-reason": requireLocalReason,
  },
};
