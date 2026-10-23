import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Risk: compliant public API documentation is rejected; Contract: a documented exported function remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "/** Does work. */\nexport function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: public functions ship without documentation after policy weakening; Contract: an undocumented export reports the JSDoc rule.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "export function doWork(): void {}",
    ruleConfig,
    ruleName,
  });
});
