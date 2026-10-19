import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "curly";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({ code: "if (enabled) { run(); }", ruleConfig, ruleName });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({ code: "if (enabled) run();", ruleConfig, ruleName });
});
