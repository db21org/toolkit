import type { ESLint, Linter } from "eslint";

export type FeatureKitRoleConvention = Readonly<{
  case: "kebab" | "pascal";
  extensions: readonly string[];
  folder: string;
  recursive?: boolean;
  suffix: string;
}>;

export type CoreEslintOptions = Readonly<{
  additionalRoles?: readonly FeatureKitRoleConvention[];
  allowedFolders?: readonly string[];
  cwd?: string;
  moduleRoots: readonly string[];
}>;

export declare const createCoreEslintConfig: (
  options: CoreEslintOptions,
) => Linter.Config;

export declare const featureKitCoreEslintPlugin: ESLint.Plugin;
export declare const coreRoleConventions: readonly FeatureKitRoleConvention[];
