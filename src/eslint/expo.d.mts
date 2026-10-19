import type { FeatureKitRoleConvention } from "@db21/toolkit/feature-kit/conventions/core/eslint";
import type { Linter } from "eslint";

import type { GraphqlLayoutOptions } from "./expo/graphql-conventions.mjs";

export type ExpoConfigOptions = Readonly<{
  cwd: string;
  sourceRoot?: string;
  moduleRoots?: readonly string[];
  additionalRoles?: readonly FeatureKitRoleConvention[];
  allowedFolders?: readonly string[];
  graphql?: GraphqlLayoutOptions;
  navigationHook?: Readonly<{
    file: string;
    importSource: string;
    name: string;
  }>;
}>;

export declare const expoRestrictedSyntax: Linter.RuleEntry[];

export declare const createExpoFeatureKitConfig: (
  options: ExpoConfigOptions,
) => Linter.Config;

export declare const createExpoConfig: (
  options: ExpoConfigOptions,
) => Linter.Config[];
