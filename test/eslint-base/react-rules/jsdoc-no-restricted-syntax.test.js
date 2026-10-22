import test from "node:test";

import { reactComponentRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/no-restricted-syntax";
const ruleConfig = reactComponentRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- A purpose-only component JSDoc block must remain valid under the React documentation policy.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Component prop tags must be rejected because props are documented on their local props type rather than duplicated in component JSDoc.
test(`${ruleName}: rejects @param tags`, async () => {
  await expectInvalid({
    code: `/**
 * Describes the component purpose.
 * @param props Component props.
 */
export const Button = (props: ButtonProps) => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Component return tags must be rejected because React render output is implied and should not create redundant documentation.
test(`${ruleName}: rejects @returns tags`, async () => {
  await expectInvalid({
    code: `/**
 * Describes the component purpose.
 * @returns Root React application element.
 */
export const App = () => null;`,
    filename: "App.tsx",
    ruleConfig,
    ruleName,
  });
});
