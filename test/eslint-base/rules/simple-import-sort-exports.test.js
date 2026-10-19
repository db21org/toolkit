import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "simple-import-sort/exports";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'export { a } from "./a";\nexport { b } from "./b";',
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'export { b } from "./b";\nexport { a } from "./a";',
    ruleConfig,
    ruleName,
  });
});
