import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { recommended } from "@db21/toolkit/eslint/base";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const assertJavascriptBehavior = async (eslint, filename) => {
  const [result] = await eslint.lintText(
    "const enabled = true;\nif (enabled) console.log(enabled);",
    { filePath: filename },
  );
  const rules = result.messages.map(({ ruleId }) => ruleId);

  assert.ok(rules.includes("curly"), filename);
  assert.ok(rules.includes("padding-line-between-statements"), filename);
  const [privateField] = await eslint.lintText(
    "class Counter {\n  #value = 1;\n  read() {\n    return this.#value;\n  }\n}\nnew Counter().read();",
    { filePath: filename },
  );

  assert.equal(privateField.fatalErrorCount, 0, filename);
  assert.equal(
    privateField.messages.some(
      ({ ruleId }) => ruleId === "no-restricted-syntax",
    ),
    false,
    filename,
  );
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: shared presets drop JS style rules or leak TypeScript-only checks across extensions; Contract: both presets enforce common style and isolate TypeScript type-aware behavior.
test("base and repository presets share style across JS and TS extensions", async () => {
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
      const filename = `consumer.${extension}`;
      const config = await eslint.calculateConfigForFile(filename);
      const isTypescript = ["ts", "tsx", "mts", "cts"].includes(extension);

      for (const rule of [
        "curly",
        "brace-style",
        "padding-line-between-statements",
        "simple-import-sort/imports",
        "simple-import-sort/exports",
        "jsdoc/require-param",
      ]) {
        assert.equal(config.rules[rule][0], 2, `${filename}: ${rule}`);
      }

      assert.equal(config.rules["max-lines"][0], 1, filename);
      assert.equal(config.rules["max-lines-per-function"][0], 1, filename);
      assert.equal(
        config.rules["@typescript-eslint/strict-boolean-expressions"]?.[0] ?? 0,
        isTypescript ? 2 : 0,
        filename,
      );
      assert.equal(
        config.languageOptions.parserOptions.projectService ?? false,
        isTypescript,
        filename,
      );

      if (!isTypescript) {
        await assertJavascriptBehavior(eslint, filename);
      }

      if (extension === "jsx") {
        const [result] = await eslint.lintText(
          "const element = <span />;\nconsole.log(element);",
          { filePath: filename },
        );

        assert.equal(result.fatalErrorCount, 0, filename);
      }
    }
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: generated JSX becomes unlintable while equivalent generated JS is exempt; Contract: broad generator directives are allowed only under generated source paths.
test("generated JSX retains the generated-source directive exception", async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: commonConfig,
  });

  for (const [filePath, expected] of [
    ["src/generated/component.jsx", false],
    ["src/components/component.jsx", true],
  ]) {
    const [result] = await eslint.lintText(
      "/* eslint-disable */\nexport const element = <span />;\n",
      { filePath },
    );

    assert.equal(result.fatalErrorCount, 0);
    assert.equal(
      result.messages.some(
        ({ ruleId }) => ruleId === "unicorn/no-abusive-eslint-disable",
      ),
      expected,
    );
  }
});

const importPlacementCases = {
  valid: [
    'import "node:fs";\nimport path from "node:path";\nvoid path;',
    '#!/usr/bin/env node\n"use strict";\n// module imports\nimport "node:fs";',
    '"use client";\n/* module imports */\nimport "react";',
    'const load = () => import("node:fs");',
  ],
  invalid: [
    'const value = 1;\nimport "node:fs";',
    'export const value = 1;\nimport assert from "node:assert/strict";',
    'import "node:fs";\nconsole.log("ready");\nimport "node:path";',
    'export { readFile } from "node:fs";\nimport "node:path";',
  ],
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: static imports after executable code evade sorting while valid directives or dynamic imports break; Contract: both presets reject misplaced static imports and allow supported exceptions.
test("static imports precede statements in shared JS and TS presets", async () => {
  for (const preset of [recommended, commonConfig]) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: preset,
    });

    for (const extension of ["js", "ts"]) {
      const config = await eslint.calculateConfigForFile(
        `consumer.${extension}`,
      );

      const languageOptions =
        extension === "ts" ? { parser: tseslint.parser } : {};

      const verify = (code) =>
        new Linter().verify(
          code,
          {
            languageOptions,
            rules: {
              "no-restricted-syntax": config.rules["no-restricted-syntax"],
            },
          },
          "consumer.js",
        );

      for (const code of importPlacementCases.valid) {
        assert.deepEqual(verify(code), [], code);
      }

      for (const code of importPlacementCases.invalid) {
        const messages = verify(code);

        assert.equal(messages.length, 1, code);
        assert.equal(messages[0].ruleId, "no-restricted-syntax", code);
        assert.match(
          messages[0].message,
          /Keep static imports at the top/u,
          code,
        );
      }

      if (extension === "ts") {
        assert.deepEqual(
          verify(
            'import type { Item } from "library";\nimport os = require("node:os");\nconst value: number = 1;',
          ),
          [],
        );
        const messages = verify(
          'type Item = string;\nimport os = require("node:os");',
        );

        assert.equal(messages.length, 1);
        assert.equal(messages[0].ruleId, "no-restricted-syntax");
      }
    }
  }
});
