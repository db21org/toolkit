import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Public function documentation must remain accepted under the selected JSDoc configuration.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "/** Does work. */\nexport function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- An undocumented exported function must be reported so the publicOnly requirement cannot silently weaken.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "export function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});
