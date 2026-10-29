const commonNumbers = new Set([-1, 0, 1, -1n, 0n, 1n]);
const numericTypes = new Set(["number", "bigint"]);
const signOperators = new Set(["-", "+"]);
const transparentTypes = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const isExplanation = (comment) => {
  const text = comment.value.trim();

  return (
    /\S/u.test(text) &&
    !/^(?:eslint\b|eslint-|global\b|globals\b|@ts-)/u.test(text)
  );
};

const hasExplanation = (sourceCode, node) => {
  const ancestors = sourceCode.getAncestors(node).toReversed();
  const containingStatement = ancestors.find((ancestor) =>
    /(?:Statement|Declaration)$/u.test(ancestor.type),
  );

  const statement = containingStatement?.parent.type.startsWith("Export")
    ? containingStatement.parent
    : containingStatement;

  const adjacentComments = [
    ...sourceCode.getCommentsBefore(node),
    ...sourceCode.getCommentsAfter(node),
  ];

  const inlineComments = adjacentComments.filter((comment) => {
    if (statement && comment.range[0] < statement.range[0]) {
      return false;
    }

    return (
      comment.loc.start.line <= node.loc.end.line &&
      comment.loc.end.line >= node.loc.start.line - 1
    );
  });

  if (inlineComments.some(isExplanation)) {
    return true;
  }

  if (!statement) {
    return false;
  }

  const leading = sourceCode.getCommentsBefore(statement).filter((comment) => {
    const precedingTokenLine = sourceCode.getTokenBefore(comment)?.loc.end.line;

    return (
      comment.loc.end.line >= statement.loc.start.line - 1 &&
      precedingTokenLine !== comment.loc.start.line
    );
  });

  const trailing = sourceCode
    .getCommentsAfter(statement)
    .filter((comment) => comment.loc.start.line === statement.loc.end.line);

  const statementComments = [...leading, ...trailing];

  return statementComments.some(isExplanation);
};

const isNamedValue = (node) => {
  let value = node;

  while (transparentTypes.has(value.parent.type)) {
    value = value.parent;
  }

  const parent = value.parent;

  if (parent.type === "VariableDeclarator") {
    return parent.id.type === "Identifier" && parent.init === value;
  }

  if (parent.type === "TSEnumMember") {
    return parent.initializer === value;
  }

  return (
    parent.type === "PropertyDefinition" &&
    !parent.computed &&
    parent.value === value
  );
};

export const namedNumbersPlugin = {
  rules: {
    "no-magic-numbers": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Require numeric literals to have a name or an explanatory comment.",
        },
        schema: [],
        messages: {
          unexplained:
            "Unexplained number {{raw}}. Extract it into a meaningfully named variable (prefer const), or add an attached comment explaining its meaning. Only -1, 0 and 1 are exempt.",
        },
      },
      create(context) {
        return {
          Literal(node) {
            if (!numericTypes.has(typeof node.value)) {
              return;
            }

            const parent = node.parent;
            const signed =
              parent.type === "UnaryExpression" &&
              signOperators.has(parent.operator);
            const valueNode = signed ? parent : node;
            const value =
              signed && parent.operator === "-" ? -node.value : node.value;

            if (
              commonNumbers.has(value) ||
              valueNode.parent.type === "TSLiteralType"
            ) {
              return;
            }

            if (
              isNamedValue(valueNode) ||
              hasExplanation(context.sourceCode, valueNode)
            ) {
              return;
            }

            context.report({
              node: valueNode,
              messageId: "unexplained",
              data: { raw: context.sourceCode.getText(valueNode) },
            });
          },
        };
      },
    },
  },
};
