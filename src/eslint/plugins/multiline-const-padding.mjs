const isMultilineConstDeclaration = (node) =>
  node.type === "VariableDeclaration" &&
  node.kind === "const" &&
  node.loc.start.line < node.loc.end.line;

const hasEmptyLine = (sourceCode, previous, current) => {
  const textBetween = sourceCode.text.slice(
    previous.range[1],
    current.range[0],
  );

  return /\n[\t ]*\n/u.test(textBetween);
};

const multilineConstPaddingRule = {
  meta: {
    docs: {
      description:
        "Require an empty line between consecutive multiline const declarations.",
    },
    fixable: "whitespace",
    messages: {
      required:
        "Add an empty line between consecutive multiline const declarations.",
    },
    schema: [],
    type: "layout",
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      VariableDeclaration(node) {
        if (!isMultilineConstDeclaration(node)) {
          return;
        }

        const statements = node.parent?.body;

        if (!Array.isArray(statements)) {
          return;
        }

        const index = statements.indexOf(node);
        const previous = statements[index - 1];

        if (
          !previous ||
          !isMultilineConstDeclaration(previous) ||
          hasEmptyLine(sourceCode, previous, node)
        ) {
          return;
        }

        context.report({
          fix: (fixer) => fixer.insertTextAfter(previous, "\n"),
          messageId: "required",
          node,
        });
      },
    };
  },
};

export const multilineConstPaddingPlugin = {
  rules: {
    "multiline-const-padding": multilineConstPaddingRule,
  },
};
