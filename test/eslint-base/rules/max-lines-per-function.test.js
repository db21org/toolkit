import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "max-lines-per-function";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- A short function must remain below the configured 60-line threshold.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "function shortTask(): void {\n  run();\n}",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- A function with 61 executable body lines must exceed the configured 60-line limit.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `function longTask(): void {\n${Array.from(
      { length: 61 },
      (_, index) => `  step${index}();`,
    ).join("\n")}\n}`,
    ruleConfig,
    ruleName,
  });
});
