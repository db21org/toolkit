import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "max-lines-per-function";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "function shortTask(): void {\n  run();\n}",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "function longTask(): void {\n  step0();\n  step1();\n  step2();\n  step3();\n  step4();\n  step5();\n  step6();\n  step7();\n  step8();\n  step9();\n  step10();\n  step11();\n  step12();\n  step13();\n  step14();\n  step15();\n  step16();\n  step17();\n  step18();\n  step19();\n  step20();\n  step21();\n  step22();\n  step23();\n  step24();\n  step25();\n  step26();\n  step27();\n  step28();\n  step29();\n  step30();\n  step31();\n  step32();\n  step33();\n  step34();\n  step35();\n  step36();\n  step37();\n  step38();\n  step39();\n  step40();\n  step41();\n  step42();\n  step43();\n  step44();\n  step45();\n  step46();\n  step47();\n  step48();\n  step49();\n  step50();\n  step51();\n  step52();\n  step53();\n  step54();\n  step55();\n  step56();\n  step57();\n  step58();\n  step59();\n  step60();\n}",
    ruleConfig,
    ruleName,
  });
});
