import test from "node:test";

import { reactComponentRules } from "../../../dist/eslint/base/rules.js";
import { expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-param";
const ruleConfig = reactComponentRules[ruleName];

test(`${ruleName}: disabled for React components`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = (props: ButtonProps) => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
