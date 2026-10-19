import type { FeatureKitRoleConvention } from "@db21/toolkit/feature-kit/conventions/core/eslint";
import type { Linter } from "eslint";

export type NestConfigOptions = Readonly<{
  cwd: string;
  sourceRoot?: string;
  moduleRoots?: readonly string[];
  additionalRoles?: readonly FeatureKitRoleConvention[];
  utilityExemptPaths?: readonly string[];
}>;

export declare const createNestConfig: (
  options: NestConfigOptions,
) => Linter.Config[];
