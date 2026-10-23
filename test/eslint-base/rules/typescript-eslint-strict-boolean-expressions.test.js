import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/strict-boolean-expressions";
const ruleConfig = recommendedRules[ruleName];
const parserOptions = {
  projectService: {
    allowDefaultProject: ["strict-boolean-expressions.ts"],
  },
  tsconfigRootDir: process.cwd(),
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: explicit empty-string handling is blocked by strict condition checks; Contract: comparing a string to an empty value remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const value: string = "";\nif (value !== "") { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: string truthiness hides empty-value behavior in conditions; Contract: a string condition reports strict-boolean-expressions.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'const value: string = "";\nif (value) { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});
