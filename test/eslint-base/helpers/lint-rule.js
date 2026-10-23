import assert from "node:assert/strict";

import { ESLint } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

import { reactConventionsPlugin } from "#eslint-base/react-conventions";

const parser = tseslint.parser;

export const lintRule = async ({
  code,
  ruleName,
  ruleConfig,
  filename = "file.ts",
  extraConfig = {},
  parserOptions = {},
}) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{js,ts,tsx}"],
        languageOptions: {
          parser,
          parserOptions: {
            ecmaFeatures: { jsx: true },
            sourceType: "module",
            ...parserOptions,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
          jsdoc,
          "react-conventions": reactConventionsPlugin,
          "simple-import-sort": simpleImportSort,
        },
        rules: {
          [ruleName]: ruleConfig,
        },
        ...extraConfig,
      },
    ],
  });

  const [result] = await eslint.lintText(code, { filePath: filename });
  const fatalMessages = result.messages.filter((message) => message.fatal);

  assert.deepEqual(
    fatalMessages,
    [],
    "The fixture must parse successfully before its rule result is asserted.",
  );

  return result.messages.filter((message) => message.ruleId === ruleName);
};

export const expectValid = async (options) => {
  const messages = await lintRule(options);

  assert.equal(messages.length, 0);
};

export const expectInvalid = async (options) => {
  const messages = await lintRule(options);

  assert.notEqual(messages.length, 0);
};
