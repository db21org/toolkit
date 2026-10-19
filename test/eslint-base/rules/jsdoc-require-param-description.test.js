import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-param-description";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `
      /**
       * Does work.
       * @param value Value to process.
       */
      export function doWork(value: string): void {}
    `,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `
      /**
       * Does work.
       * @param value
       */
      export function doWork(value: string): void {}
    `,
    ruleConfig,
    ruleName,
  });
});
