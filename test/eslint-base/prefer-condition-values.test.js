import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { recommended } from "@db21/toolkit/eslint/base";
import { preferConditionValuesPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-conditions/prefer-named-values";
const verify = (source) =>
  new Linter().verify(
    source,
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tseslint.parser },
      plugins: { "db21-conditions": preferConditionValuesPlugin },
      rules: { [rule]: "error" },
    },
    "consumer.ts",
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: hidden callback computations evade condition readability policy or unsafe fixes change short-circuit and loop behavior; Contract: callback calls across condition forms report named-value guidance without fixes while predicates, branches and callback-local computations stay valid.
test("requires named results for inline-callback computations in conditions", () => {
  for (const source of [
    "if (!page.products.some(({ id }) => id === productId)) act();",
    "if (ready && items.some((item) => item.active)) act();",
    "if (Boolean(items.find((item) => item.active))) act();",
    "while (items.some((item) => item.active)) act();",
    "do { act(); } while (items.some((item) => item.active));",
    "for (; items.some((item) => item.active); advance()) act();",
    "const label = items.some((item) => item.active) ? yes : no;",
    "switch (items.findIndex((item) => item.active)) { default: break; }",
    "if (items?.some?.((item) => item.active)) act();",
    "if (items.some(function (item) { return item.active; })) act();",
    "if (items.some(((item) => item.active) as Predicate)) act();",
    "if (items.some((item) => other.some((value) => value === item))) act();",
  ]) {
    const messages = verify(source);

    assert.equal(messages.length, 1, source);
    assert.equal(messages[0].ruleId, rule, source);
    assert.equal(messages[0].messageId, "extract", source);
    assert.match(
      messages[0].message,
      /named constant.*short-circuit.*recomputed/u,
    );
    assert.equal(messages[0].fix, undefined);
    assert.equal(messages[0].suggestions, undefined);
  }

  for (const source of [
    "const hasProduct = page.products.some(({ id }) => id === productId); if (!hasProduct) act();",
    "if (isDefined(previous)) act();",
    "if (items.some(isActive)) act();",
    "if (ready) items.some((item) => item.active);",
    "const value = ready ? items.find((item) => item.active) : fallback;",
    "function check() { return items.some((item) => item.active); }",
    "for (items.forEach((item) => prepare(item)); ready; items.forEach((item) => advance(item))) act();",
    "switch (value) { case items.find((item) => item.active): break; }",
  ]) {
    assert.deepEqual(verify(source), [], source);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: conditional-computation policy disappears in a supported preset or source extension; Contract: shared JS and TS presets and React composition consistently expose error severity.
test("shared presets enforce named condition computations", async () => {
  const errorSeverity = 2;

  for (const preset of [recommended, commonConfig]) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: preset,
    });

    for (const extension of [
      "js",
      "jsx",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "mts",
      "cts",
    ]) {
      const config = await eslint.calculateConfigForFile(
        `consumer.${extension}`,
      );

      assert.equal(config.rules[rule][0], errorSeverity, extension);
    }
  }
});
