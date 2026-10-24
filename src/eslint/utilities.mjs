import { requireExtractedUtilitiesPlugin } from "./plugins/index.mjs";

export const createUtilityExtractionConfig = ({
  files = ["src/**/*.ts"],
  exemptPaths = ["packages/utils/src"],
} = {}) => ({
  files,
  plugins: {
    "db21-utilities": requireExtractedUtilitiesPlugin,
  },
  rules: {
    "db21-utilities/require-extracted-utilities": ["error", { exemptPaths }],
  },
});
