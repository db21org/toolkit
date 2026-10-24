import { createNestjsEslintConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/eslint";

import commonConfig, { createUtilityExtractionConfig } from "./index.mjs";

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
    createUtilityExtractionConfig({
      files: [`${sourceRoot}/**/*.ts`],
      exemptPaths: utilityExemptPaths,
    }),
    nestjsConfig,
  ];
};
