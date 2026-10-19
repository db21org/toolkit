import type {
  CoreEslintOptions,
  FeatureKitRoleConvention,
} from "@db21/toolkit/feature-kit/conventions/core/eslint";
import type { Linter } from "eslint";

export type NestjsEslintOptions = Omit<CoreEslintOptions, "allowedFolders">;

export declare const createNestjsEslintConfig: (
  options: NestjsEslintOptions,
) => Linter.Config;

export declare const nestjsRoleConventions: readonly FeatureKitRoleConvention[];
export declare const nestjsFolderConventions: readonly string[];
