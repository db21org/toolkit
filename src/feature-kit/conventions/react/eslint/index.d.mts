import type {
  CoreEslintOptions,
  FeatureKitRoleConvention,
} from "@db21/toolkit/feature-kit/conventions/core/eslint";
import type { ESLint, Linter } from "eslint";

export declare const createReactEslintConfig: (
  options: CoreEslintOptions,
) => Linter.Config;

export declare const featureKitReactEslintPlugin: ESLint.Plugin;
export declare const reactRoleConventions: readonly FeatureKitRoleConvention[];
