import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "/** Does work. */\nexport function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "export function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});
