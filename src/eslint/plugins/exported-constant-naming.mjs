const upperSnakeCasePattern = /^[A-Z][A-Z\d]*(?:_[A-Z\d]+)*$/u;

const hasNoTemplateExpressions = (node) => {
  // Avoid making the standalone ESLint plugin depend on application utilities.
  // eslint-disable-next-line no-restricted-syntax
  return node.expressions.length === 0;
};

const unwrapTypeExpression = (node) => {
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion"
  ) {
    return unwrapTypeExpression(node.expression);
  }

  return node;
};

const isPrimitiveLiteral = (node) => {
  const initializer = unwrapTypeExpression(node);

  if (initializer.type === "TemplateLiteral") {
    return hasNoTemplateExpressions(initializer);
  }

  if (initializer.type === "Literal") {
    return ["boolean", "number", "string"].includes(typeof initializer.value);
  }

  if (
    initializer.type !== "UnaryExpression" ||
    !["+", "-"].includes(initializer.operator)
  ) {
    return false;
  }

  return (
    initializer.argument.type === "Literal" &&
    typeof initializer.argument.value === "number"
  );
};

const exportedConstantNamingRule = {
  meta: {
    docs: {
      description:
        "Require exported primitive literal constants to use UPPER_SNAKE_CASE.",
    },
    messages: {
      exportedConstantName:
        "Exported primitive constant '{{name}}' must use UPPER_SNAKE_CASE.",
    },
    schema: [],
    type: "suggestion",
  },
  create(context) {
    const primitiveConstants = new Set();
    const namedExports = [];

    const reportName = (name, node) => {
      if (!upperSnakeCasePattern.test(name)) {
        context.report({
          data: { name },
          messageId: "exportedConstantName",
          node,
        });
      }
    };

    return {
      "Program:exit"() {
        for (const { exported, local } of namedExports) {
          if (primitiveConstants.has(local.name)) {
            const exportedName =
              exported.type === "Identifier" ? exported.name : exported.value;

            if (typeof exportedName === "string") {
              reportName(exportedName, exported);
            }
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.declaration && !node.source) {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === "ExportSpecifier" &&
              specifier.local.type === "Identifier"
            ) {
              namedExports.push(specifier);
            }
          }
        }
      },
      "ExportNamedDeclaration > VariableDeclaration[kind='const']"(node) {
        for (const declaration of node.declarations) {
          if (
            declaration.id.type === "Identifier" &&
            declaration.init &&
            isPrimitiveLiteral(declaration.init)
          ) {
            reportName(declaration.id.name, declaration.id);
          }
        }
      },
      "Program > VariableDeclaration[kind='const']"(node) {
        for (const declaration of node.declarations) {
          if (
            declaration.id.type === "Identifier" &&
            declaration.init &&
            isPrimitiveLiteral(declaration.init)
          ) {
            primitiveConstants.add(declaration.id.name);
          }
        }
      },
    };
  },
};

export const exportedConstantNamingPlugin = {
  rules: { "exported-constant-naming": exportedConstantNamingRule },
};
