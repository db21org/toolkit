const isIdentityAlias = (node) => {
  if (node.type !== "TSTypeAliasDeclaration" || node.typeParameters) {
    return false;
  }

  return (
    node.typeAnnotation.type === "TSTypeReference" &&
    !node.typeAnnotation.typeArguments
  );
};

const noRedundantAlias = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Export original types instead of redundant identity aliases.",
    },
    schema: [],
    messages: {
      identity:
        "Export and use the original type instead of introducing a redundant exported alias. Keep aliases that compose, specialize or change a type.",
    },
  },
  create(context) {
    const reported = new Set();

    const report = (node) => {
      if (isIdentityAlias(node) && !reported.has(node)) {
        reported.add(node);
        context.report({ node, messageId: "identity" });
      }
    };

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          report(node.declaration);
        }

        if (node.source) {
          return;
        }

        for (const specifier of node.specifiers) {
          let scope = context.sourceCode.getScope(node);

          while (scope) {
            const variable = scope.set.get(specifier.local.name);

            if (variable) {
              for (const definition of variable.defs) {
                report(definition.node);
              }

              break;
            }

            scope = scope.upper;
          }
        }
      },
    };
  },
};

export const exportedTypeAliasPlugin = {
  rules: { "no-redundant-alias": noRedundantAlias },
};
