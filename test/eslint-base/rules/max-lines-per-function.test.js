import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "max-lines-per-function";
const ruleConfig = recommendedRules[ruleName];
const oversizedFunctionLineCount = 61;

// eslint-disable-next-line db21-tests/require-justification -- Risk: the function-size limit rejects concise implementation units; Contract: a function below sixty executable lines remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "function shortTask(): void {\n  run();\n}",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: oversized functions evade the configured maintainability limit; Contract: sixty-one executable body lines report max-lines-per-function.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `function longTask(): void {\n${Array.from(
      { length: oversizedFunctionLineCount },
      (_, index) => `  step${index}();`,
    ).join("\n")}\n}`,
    ruleConfig,
    ruleName,
  });
});
