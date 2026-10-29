import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { recommended } from "@db21/toolkit/eslint/base";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const enabledRuleSeverity = 2;
const expectedSizeDiagnosticCount = 2;
const configuredMaximumLineCount = 3;
const sourceExtensions = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const sharedStyleRules = [
  "curly",
  "brace-style",
  "padding-line-between-statements",
  "simple-import-sort/imports",
  "simple-import-sort/exports",
  "jsdoc/require-param",
];

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

    for (const extension of sourceExtensions) {
      const filename = `consumer.${extension}`;
      const config = await eslint.calculateConfigForFile(filename);
      const typescriptExtensions = ["ts", "tsx", "mts", "cts"];
      const isTypescript = typescriptExtensions.includes(extension);

      for (const rule of sharedStyleRules) {
        assert.equal(
          config.rules[rule][0],
          enabledRuleSeverity,
          `${filename}: ${rule}`,
        );
      }

      assert.equal(config.rules["max-lines"][0], enabledRuleSeverity, filename);
      assert.equal(
        config.rules["max-lines-per-function"][0],
        enabledRuleSeverity,
        filename,
      );
      assert.equal(
        config.rules["@typescript-eslint/strict-boolean-expressions"]?.[0] ?? 0,
        isTypescript ? enabledRuleSeverity : 0,
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: custom diagnostic processing drops size guidance or changes core violations and suppressions; Contract: both public presets append actionable guidance without changing rule IDs, counts, locations or valid exceptions.
test("size diagnostics guide refactoring without changing core enforcement", async () => {
  const code =
    "export function run() {\n// ignored comment\n\nconsole.log(1);\nconsole.log(2);\n}\n";

  const options = [
    "error",
    {
      max: configuredMaximumLineCount,
      skipComments: true,
      skipBlankLines: true,
    },
  ];

  for (const preset of [recommended, commonConfig]) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: preset,
    });

    for (const extension of ["js", "ts"]) {
      const config = await eslint.calculateConfigForFile(
        `consumer.${extension}`,
      );

      const isolated = {
        languageOptions: { parser: tseslint.parser },
        plugins: config.plugins,
        processor: config.processor,
        rules: { "max-lines": options, "max-lines-per-function": options },
      };
      const linter = new Linter();
      const baseline = linter.verify(code, {
        languageOptions: isolated.languageOptions,
        rules: isolated.rules,
      });
      const processed = linter.verify(code, isolated);

      assert.equal(processed.length, expectedSizeDiagnosticCount);

      for (const [index, diagnostic] of processed.entries()) {
        const { message, ...details } = diagnostic;
        const { message: original, ...originalDetails } = baseline[index];

        assert.deepEqual(details, originalDetails);
        assert.ok(message.startsWith(original));
        assert.match(message, /\(4\).*3/u);
        assert.match(message, /Refactor.*cohesive/u);
        assert.match(message, /test/u);
        assert.match(message, /bypass this limit/u);
      }

      assert.deepEqual(
        linter.verify(
          `/* eslint-disable max-lines, max-lines-per-function */\n${code}`,
          isolated,
        ),
        [],
      );
    }
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
