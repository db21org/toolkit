import astro from "eslint-plugin-astro";
import typescriptEslint from "typescript-eslint";

import {
  commonConfig,
  typescriptRepositoryPlugins,
  typescriptRepositoryRules,
} from "./index.mjs";

const astroFiles = ["**/*.astro"];
const astroRepositoryRules = Object.fromEntries(
  Object.entries(typescriptRepositoryRules).filter(([name]) =>
    name.startsWith("db21-"),
  ),
);

const astroRepositoryPolicy = {
  plugins: {
    ...typescriptRepositoryPlugins,
  },
  rules: {
    ...astroRepositoryRules,
    "db21-filenames/typescript-filename": "off",
  },
};

export const astroConfig = [
  ...commonConfig,
  ...astro.configs.recommended,
  {
    ...astroRepositoryPolicy,
    files: astroFiles,
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".astro"],
        parser: typescriptEslint.parser,
      },
    },
    processor: "astro/client-side-ts",
  },
];

export default astroConfig;
