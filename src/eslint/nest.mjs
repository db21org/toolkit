import { createNestjsEslintConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/eslint";
import { isNotDefined } from "@db21/toolkit/utils";

import commonConfig from "./index.mjs";
import { requireExtractedUtilitiesPlugin } from "./plugins/index.mjs";

export const createNestConfig = ({
  cwd,
  sourceRoot = "src",
  moduleRoots = [`${sourceRoot}/features`, `${sourceRoot}/modules`],
  additionalRoles = [],
  utilityExemptPaths,
}) => {
  const nestjsConfig = createNestjsEslintConfig({
    cwd,
    moduleRoots,
    additionalRoles,
  });

  return [
    ...commonConfig,
    {
      files: [`${sourceRoot}/**/*.ts`],
      plugins: {
        "db21-utilities": requireExtractedUtilitiesPlugin,
      },
      rules: {
        "db21-utilities/require-extracted-utilities": [
          "error",
          ...(isNotDefined(utilityExemptPaths)
            ? []
            : [{ exemptPaths: utilityExemptPaths }]),
        ],
      },
    },
    nestjsConfig,
  ];
};
