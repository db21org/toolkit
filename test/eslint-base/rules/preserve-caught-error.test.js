import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectValid } from "../helpers/lint-rule.js";

const ruleName = "preserve-caught-error";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: allowed by config`, async () => {
  await expectValid({
    code: 'try { run(); } catch (error) { throw new Error("Failed"); }',
    ruleConfig,
    ruleName,
  });
});
