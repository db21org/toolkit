import test from "node:test";

import { reactComponentRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = reactComponentRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Risk: the component documentation policy rejects a compliant public component; Contract: a documented exported component remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: public React components ship without required documentation; Contract: an undocumented exported component reports the JSDoc rule.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
