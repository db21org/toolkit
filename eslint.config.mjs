import config from "./dist/eslint/index.mjs";
import { reactConfig, reactHookRules } from "./dist/eslint/index.mjs";

export default [
  ...config,
  { ignores: ["test/fixtures/**"] },
  {
    files: [
      "src/feature-kit/react/**/*.{ts,tsx}",
      "test/feature-kit/react/**/*.{ts,tsx}",
    ],
    plugins: reactConfig.plugins,
    rules: reactHookRules,
  },
  {
    ...reactConfig,
    files: ["src/feature-kit/react/**/*.tsx"],
  },
];
