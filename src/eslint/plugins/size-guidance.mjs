const guidance = {
  "max-lines":
    "Refactor into cohesive modules with clear responsibilities and explicit boundaries. Keep related code together so it remains readable and testable; do not split files arbitrarily or compress formatting to bypass this limit.",
  "max-lines-per-function":
    "Refactor to one clear responsibility: simplify control flow and extract cohesive, well-named helpers. Preserve behavior and make inputs and outputs easy to test; do not compress formatting or add trivial wrappers to bypass this limit.",
};

export const addSizeGuidance = (messages) =>
  messages.map((message) =>
    Object.hasOwn(guidance, message.ruleId)
      ? {
          ...message,
          message: `${message.message} ${guidance[message.ruleId]}`,
        }
      : message,
  );

export const sizeGuidancePlugin = {
  processors: {
    "refactor-guidance": {
      meta: { name: "db21-size-refactor-guidance", version: "1.0.0" },
      preprocess: (text) => [text],
      postprocess: (messages) => addSizeGuidance(messages.flat()),
      supportsAutofix: true,
    },
  },
};
