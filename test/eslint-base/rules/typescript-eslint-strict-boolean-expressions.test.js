import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/strict-boolean-expressions";
const ruleConfig = recommendedRules[ruleName];
const parserOptions = {
  projectService: {
    allowDefaultProject: ["strict-boolean-expressions.ts"],
  },
  tsconfigRootDir: process.cwd(),
};

// eslint-disable-next-line db21-tests/require-justification -- An explicit empty-string comparison must remain valid under the strict boolean options.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const value: string = "";\nif (value !== "") { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- A string used directly as a condition must be rejected so truthiness cannot hide empty-value behavior.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'const value: string = "";\nif (value) { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});
