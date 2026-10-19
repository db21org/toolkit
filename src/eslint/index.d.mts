import type { Linter } from "eslint";

export const commonConfig: Linter.Config[];
export const commonPredicateRestrictedSyntax: Linter.RuleEntry[];
export const inheritedRestrictedSyntax: Linter.RuleEntry[];
export const reactConfig: Linter.Config;
export const reactHookRules: Linter.RulesRecord;
export const reactPackageConfig: Linter.Config[];
export const sonarRules: Linter.RulesRecord;
export const typescriptRepositoryPlugins: Linter.Config["plugins"];
export const typescriptRepositoryRules: Linter.RulesRecord;
export const typescriptSonarRules: Linter.RulesRecord;
export const unicornRules: Linter.RulesRecord;

export default commonConfig;
