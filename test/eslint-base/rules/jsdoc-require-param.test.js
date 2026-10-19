import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-param";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "/**\n * Does work.\n * @param value\n */\nexport function doWork(value: string): void {}",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "/** Does work. */\nexport function doWork(value: string): void {}",
    ruleConfig,
    ruleName,
  });
});
