import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/parameter-properties";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "class User { constructor(private readonly id: string) {} }",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "class User { private readonly id: string; constructor(id: string) { this.id = id; } }",
    ruleConfig,
    ruleName,
  });
});
