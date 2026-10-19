import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/prefer-nullish-coalescing";
const ruleConfig = recommendedRules[ruleName];
const parserOptions = {
  projectService: {
    allowDefaultProject: ["prefer-nullish-coalescing.ts"],
  },
  tsconfigRootDir: process.cwd(),
};

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const input: string | null = null;\nconst value = input ?? "fallback";',
    filename: "prefer-nullish-coalescing.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'const input: string | null = null;\nconst value = input || "fallback";',
    filename: "prefer-nullish-coalescing.ts",
    parserOptions,
    ruleConfig,
    ruleName,
  });
});
