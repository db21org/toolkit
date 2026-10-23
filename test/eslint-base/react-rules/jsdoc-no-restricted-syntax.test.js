import test from "node:test";

import { reactComponentRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/no-restricted-syntax";
const ruleConfig = reactComponentRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Risk: compliant purpose-only component documentation is rejected; Contract: a documented component without redundant tags remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: component JSDoc duplicates props documentation and drifts from local types; Contract: a component @param tag reports the restriction.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: redundant component return documentation becomes stale; Contract: a component @returns tag reports the restriction.
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
