import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "simple-import-sort/imports";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'import a from "a";\nimport b from "b";',
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'import b from "b";\nimport a from "a";',
    ruleConfig,
    ruleName,
  });
});
