import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/explicit-function-return-type";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- An explicit arrow return type must remain accepted under the repository API annotation requirement.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "const getValue = (): number => 1;",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- An unannotated arrow return must be reported so inferred return contracts do not leak across module boundaries.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "const getValue = () => 1;",
    ruleConfig,
    ruleName,
  });
});
