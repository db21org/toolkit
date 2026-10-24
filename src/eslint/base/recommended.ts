import { sizeGuidancePlugin } from "@db21/toolkit/eslint/plugins";
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
    "db21-size": sizeGuidancePlugin,
    "simple-import-sort": simpleImportSort,
  },
  rules: { ...commonRules, ...maxLinesRules },
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
    "db21-size": sizeGuidancePlugin,
    "simple-import-sort": simpleImportSort,
  },
  rules: { ...recommendedRules, ...maxLinesRules },
});

export const recommended = defineConfig(
  javascriptRecommended,
  typescriptRecommended,
);
