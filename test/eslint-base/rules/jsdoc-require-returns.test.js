import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-returns";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `
      /**
       * Does work.
       * @returns Result text.
       */
      export function doWork(): string {
        return "ok";
      }
    `,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `
      /** Does work. */
      export function doWork(): string {
        return "ok";
      }
    `,
    ruleConfig,
    ruleName,
  });
});
