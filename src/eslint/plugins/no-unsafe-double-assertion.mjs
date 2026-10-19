const assertionNodeTypes = new Set(["TSAsExpression", "TSTypeAssertion"]);
const unsafeIntermediateTypes = new Set(["TSAnyKeyword", "TSUnknownKeyword"]);

const noUnsafeDoubleAssertionRule = {
  meta: {
    docs: {
      description:
        "Disallow double type assertions that bypass structural compatibility through any or unknown.",
    },
    messages: {
      unsafeDoubleAssertion:
        "Replace this unsafe double assertion with validation, a type guard, or a typed adapter.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    const checkAssertion = (node) => {
      const intermediateAssertion = node.expression;

      if (
        assertionNodeTypes.has(intermediateAssertion.type) &&
        unsafeIntermediateTypes.has(intermediateAssertion.typeAnnotation.type)
      ) {
        context.report({ messageId: "unsafeDoubleAssertion", node });
      }
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
};

export const noUnsafeDoubleAssertionPlugin = {
  rules: {
    "no-unsafe-double-assertion": noUnsafeDoubleAssertionRule,
  },
};
