import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/tag-lines";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: allowed by config`, async () => {
  await expectValid({
    code: '/**\n * Does work.\n *\n * @returns value\n */\nexport function doWork(): string { return "ok"; }',
    ruleConfig,
    ruleName,
  });
});
