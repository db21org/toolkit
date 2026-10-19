import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/restrict-template-expressions";
const ruleConfig = recommendedRules[ruleName];
const parserOptions = {
  projectService: {
    allowDefaultProject: ["restrict-template-expressions.ts"],
  },
  tsconfigRootDir: process.cwd(),
};

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const value: string = "ok";\nconst text = `${value}`;',
    filename: "restrict-template-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "const value: object = {};\nconst text = `${value}`;",
    filename: "restrict-template-expressions.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});
