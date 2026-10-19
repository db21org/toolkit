import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/no-inferrable-types";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: allowed by config`, async () => {
  await expectValid({ code: "const count: number = 1;", ruleConfig, ruleName });
});
