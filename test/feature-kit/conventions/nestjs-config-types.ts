import { createNestjsDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/dependency-cruiser";
import { createNestjsEslintConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/eslint";

const cwd = "/tmp/feature-kit-nestjs";

export const dependencyConfig = createNestjsDependencyCruiserConfig({
  allow: ["src/shared"],
  cwd,
  moduleRoots: ["src/features", "src/modules"],
  sourceRoot: "src",
});

export const eslintConfig = createNestjsEslintConfig({
  cwd,
  moduleRoots: ["src/features", "src/modules"],
});
