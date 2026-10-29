import {
  logicalChecksPlugin,
  namedArraysPlugin,
  namedNumbersPlugin,
  preferConditionValuesPlugin,
  sizeGuidancePlugin,
} from "@db21/toolkit/eslint/plugins";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

import { commonRules, maxLinesRules, recommendedRules } from "./rules.js";

export const javascriptRecommended = defineConfig({
  processor: "db21-size/refactor-guidance",
  files: ["**/*.{js,jsx,mjs,cjs}"],
  extends: [js.configs.recommended, jsdoc.configs["flat/recommended"]],
  languageOptions: {
    globals: globals.node,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: {
    "db21-arrays": namedArraysPlugin,
    "db21-conditions": preferConditionValuesPlugin,
    "db21-logic": logicalChecksPlugin,
    "db21-numbers": namedNumbersPlugin,
    "db21-size": sizeGuidancePlugin,
    "simple-import-sort": simpleImportSort,
  },
  rules: {
    ...commonRules,
    ...maxLinesRules,
    "db21-arrays/no-inline-member-access": "error",
    "db21-conditions/prefer-named-values": "error",
    "db21-logic/max-checks": "error",
    "db21-numbers/no-magic-numbers": "error",
  },
});

export const typescriptRecommended = defineConfig({
  processor: "db21-size/refactor-guidance",
  files: ["**/*.{ts,tsx,mts,cts}"],
  extends: [
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    jsdoc.configs["flat/recommended-typescript"],
  ],
  languageOptions: {
    globals: globals.node,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: process.cwd(),
    },
  },
  plugins: {
    "db21-arrays": namedArraysPlugin,
    "db21-conditions": preferConditionValuesPlugin,
    "db21-logic": logicalChecksPlugin,
    "db21-numbers": namedNumbersPlugin,
    "db21-size": sizeGuidancePlugin,
    "simple-import-sort": simpleImportSort,
  },
  rules: {
    ...recommendedRules,
    ...maxLinesRules,
    "db21-arrays/no-inline-member-access": "error",
    "db21-conditions/prefer-named-values": "error",
    "db21-logic/max-checks": "error",
    "db21-numbers/no-magic-numbers": "error",
  },
});

export const recommended = defineConfig(
  javascriptRecommended,
  typescriptRecommended,
);
