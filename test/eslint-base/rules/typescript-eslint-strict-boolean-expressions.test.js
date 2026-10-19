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

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const value: string = "";\nif (value !== "") { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'const value: string = "";\nif (value) { run(); }',
    filename: "strict-boolean-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});
