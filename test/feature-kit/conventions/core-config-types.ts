import { createCoreDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/core/dependency-cruiser";
import { createCoreEslintConfig } from "@db21/toolkit/feature-kit/conventions/core/eslint";

const cwd = "/tmp/feature-kit-core";

export const dependencyConfig = createCoreDependencyCruiserConfig({
  allow: ["src/shared"],
  cwd,
  moduleRoots: ["src/features"],
  sourceRoot: "src",
});

export const eslintConfig = createCoreEslintConfig({
  cwd,
  moduleRoots: ["src/features"],
});
