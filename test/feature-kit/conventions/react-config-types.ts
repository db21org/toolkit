import { createReactDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/react/dependency-cruiser";
import { createReactEslintConfig } from "@db21/toolkit/feature-kit/conventions/react/eslint";

const cwd = "/tmp/feature-kit-react";

export const dependencyConfig = createReactDependencyCruiserConfig({
  allow: ["src/ui"],
  cwd,
  moduleRoots: ["src/features"],
  sourceRoot: "src",
});

export const eslintConfig = createReactEslintConfig({
  cwd,
  moduleRoots: ["src/features"],
});
