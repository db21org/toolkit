import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { react, recommended } from "@db21/toolkit/eslint/base";
import { createExpoConfig } from "@db21/toolkit/eslint/expo";
import reactConfig from "@db21/toolkit/eslint/react";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const presets = [
  ["base React", [...recommended, { files: ["**/*.tsx"], ...react }]],
  ["React package", reactConfig],
  [
    "Expo",
    createExpoConfig({ cwd: resolve(import.meta.dirname, "../fixtures/expo") }),
  ],
  ["common", commonConfig],
];

const verify = (config, code) =>
  new Linter().verify(code, {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "max-lines-per-function": config.rules["max-lines-per-function"],
      "no-restricted-syntax": config.rules["no-restricted-syntax"],
    },
  });

const assertSizeBoundary = (config, max, name) => {
  const code = (lines) =>
    `const screen = () => {\n// excluded comment\n\n${"console.log('render');\n".repeat(lines - 3)}return <span />;\n};`;

  assert.deepEqual(verify(config, code(max)), [], name);
  const messages = verify(config, code(max + 1));

  assert.equal(messages.length, 1, name);
  assert.equal(messages[0].ruleId, "max-lines-per-function", name);
  assert.equal(messages[0].severity, 2, name);
  assert.equal(messages[0].line, 1, name);
};

const syntaxMessages = (config, code) =>
  verify(config, code).map(({ message }) => message);

const assertSharedSyntax = (config, name) => {
  for (const [code, message] of [
    ['const value = 1;\nimport "react";', /Keep static imports at the top/u],
    ["class Example { #value = 1; }", /TypeScript private\/protected/u],
    ["const run = async () => { if (await ready()) {} };", /Do not await/u],
  ]) {
    assert.match(syntaxMessages(config, code)[0], message, name);
  }

  if (name !== "base React") {
    assert.match(
      syntaxMessages(config, "type Value = string | null;")[0],
      /Use Maybe<T>/u,
      name,
    );
    assert.match(
      syntaxMessages(config, "const empty = items.length === 0;")[0],
      /Use isEmpty\/isNotEmpty/u,
      name,
    );
  }
};

const assertExpoPolicy = (config, name) => {
  for (const [code, message] of [
    ["const screen = <span>Hello</span>;", /i18n translation/u],
    ["const screen = <View style={layout} />;", /NativeWind/u],
    ["const screen = <>{visible ? <View /> : null}</>;", /condition &&/u],
    ['export { Data } from "./generated/graphql";', /feature-private/u],
  ]) {
    const messages = syntaxMessages(config, code);

    if (name === "Expo") {
      assert.equal(messages.length, 1, name);
      assert.match(messages[0], message, name);
    } else {
      assert.deepEqual(messages, [], name);
    }
  }
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: preset composition drops shared restrictions, weakens Expo policy or leaks React limits into ordinary functions; Contract: public presets enforce React spacing and exact error-level size boundaries while preserving shared and platform-specific checks.
test("React policies compose without losing shared or Expo restrictions", async () => {
  for (const [name, preset] of presets) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: preset,
    });

    for (const extension of ["ts", "tsx"]) {
      const config = await eslint.calculateConfigForFile(
        `src/components/Screen.${extension}`,
      );
      const isReact = extension === "tsx" && name !== "common";

      assertSizeBoundary(config, isReact ? 150 : 60, `${name}: ${extension}`);
      assert.equal(config.rules["max-lines"][1].max, 300, name);
      assert.equal(
        syntaxMessages(config, 'const screen = <span>{" "}</span>;').length,
        isReact || name === "Expo" ? 1 : 0,
        name,
      );
      assertSharedSyntax(config, name);
      assertExpoPolicy(config, name);
    }
  }
});
