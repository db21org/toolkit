import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "brace-style";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "if (ready) {\n  run();\n} else {\n  stop();\n}",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "if (ready) {\n  run();\n}\nelse {\n  stop();\n}",
    ruleConfig,
    ruleName,
  });
});
