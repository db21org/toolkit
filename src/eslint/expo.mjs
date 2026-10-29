import { createReactEslintConfig } from "@db21/toolkit/feature-kit/conventions/react/eslint";

import { createFeatureGraphqlPlugin } from "./expo/feature-graphql.mjs";
import commonConfig, { reactConfig, reactHookRules } from "./index.mjs";

const translatableAttributePattern =
  "^(accessibilityHint|accessibilityLabel|alt|aria-description|aria-label|caption|content|description|emptyMessage|errorMessage|helperText|label|message|placeholder|subtitle|text|title)$";

const appRestrictedSyntax = [
  {
    selector: "JSXText[value=/\\S/]",
    message:
      "Use an i18n translation instead of hardcoded user-facing JSX text.",
  },
  {
    selector: `JSXElement > JSXExpressionContainer > Literal[value=/\\S/][raw=/^("|')/], JSXFragment > JSXExpressionContainer > Literal[value=/\\S/][raw=/^("|')/]`,
    message:
      "Use an i18n translation instead of a hardcoded user-facing string.",
  },
  {
    selector: `JSXElement > JSXExpressionContainer > ConditionalExpression > Literal[value=/\\S/][raw=/^("|')/], JSXFragment > JSXExpressionContainer > ConditionalExpression > Literal[value=/\\S/][raw=/^("|')/]`,
    message:
      "Use i18n translations instead of hardcoded strings returned by a JSX conditional.",
  },
  {
    selector: `JSXElement > JSXExpressionContainer > LogicalExpression > Literal[value=/\\S/][raw=/^("|')/], JSXFragment > JSXExpressionContainer > LogicalExpression > Literal[value=/\\S/][raw=/^("|')/]`,
    message:
      "Use an i18n translation instead of a hardcoded string returned by a JSX expression.",
  },
  {
    selector:
      "JSXElement > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/\\S/], JSXFragment > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/\\S/]",
    message:
      "Use an i18n translation instead of a hardcoded user-facing template string.",
  },
  {
    selector: `JSXAttribute[name.name=/${translatableAttributePattern}/][value.type="Literal"][value.value=/\\S/]`,
    message:
      "Use an i18n translation instead of a hardcoded user-facing attribute.",
  },
  {
    selector: `JSXAttribute[name.name=/${translatableAttributePattern}/] > JSXExpressionContainer > Literal[value=/\\S/][raw=/^("|')/]`,
    message:
      "Use an i18n translation instead of a hardcoded user-facing attribute value.",
  },
  {
    selector: `JSXAttribute[name.name=/${translatableAttributePattern}/] > JSXExpressionContainer > ConditionalExpression > Literal[value=/\\S/][raw=/^("|')/]`,
    message:
      "Use i18n translations instead of hardcoded strings returned by a user-facing attribute.",
  },
  {
    selector: `JSXAttribute[name.name=/${translatableAttributePattern}/] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/\\S/]`,
    message:
      "Use an i18n translation instead of a hardcoded user-facing attribute template.",
  },
  {
    selector: 'JSXAttribute[name.name="style"]',
    message:
      "Prefer NativeWind className tokens instead of the style prop. If inline style is unavoidable, disable this rule locally with a reason.",
  },
  {
    selector:
      "ExportAllDeclaration[source.value=/generated/], ExportNamedDeclaration[source.value=/generated/]",
    message:
      "Generated GraphQL artifacts are feature-private and must not be re-exported.",
  },
];

export const expoRestrictedSyntax = [
  ...reactConfig.rules["no-restricted-syntax"].slice(1),
  ...appRestrictedSyntax,
];

const createExpoRoles = () => [
  { case: "kebab", extensions: [".ts"], folder: "schemas", suffix: ".schema" },
  {
    case: "pascal",
    extensions: [".tsx"],
    folder: "components",
    recursive: true,
    suffix: "",
  },
  {
    case: "kebab",
    extensions: [".ts"],
    folder: "providers",
    suffix: ".provider",
  },
  {
    case: "kebab",
    extensions: [".ts"],
    folder: "repositories",
    suffix: ".repository",
  },
  { case: "kebab", extensions: [".ts"], folder: "types", suffix: ".type" },
];

const expoAllowedFolders = [
  "cache",
  "components",
  "generated",
  "graphql",
  "hooks",
  "locales",
  "providers",
  "queries",
  "react-providers",
  "repositories",
  "schemas",
  "services",
  "surfaces",
  "test",
  "types",
  "utils",
];

export const createExpoFeatureKitConfig = ({
  cwd,
  sourceRoot = "src",
  moduleRoots = [`${sourceRoot}/features`, `${sourceRoot}/modules`],
  additionalRoles = [],
  allowedFolders,
}) =>
  createReactEslintConfig({
    additionalRoles: [...createExpoRoles(), ...additionalRoles],
    allowedFolders: allowedFolders ?? [
      ...expoAllowedFolders,
      ...additionalRoles.map(({ folder }) => folder),
    ],
    cwd,
    moduleRoots,
  });

const createNavigationConfig = (sourceRoot, navigationHook) => [
  {
    files: [`${sourceRoot}/**/*.{ts,tsx}`],
    plugins: reactConfig.plugins,
    rules: {
      ...reactHookRules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              importNames: ["useRouter"],
              message: `Use ${navigationHook.name} from ${navigationHook.importSource} as the configured navigation entry point.`,
              name: "expo-router",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...expoRestrictedSyntax],
    },
  },
  {
    files: [navigationHook.file],
    rules: { "no-restricted-imports": "off" },
  },
];

export const createExpoConfig = ({
  cwd,
  sourceRoot = "src",
  moduleRoots = [`${sourceRoot}/features`, `${sourceRoot}/modules`],
  additionalRoles = [],
  allowedFolders,
  graphql = {},
  navigationHook = {
    file: `${sourceRoot}/components/navigation/use-app-router.hook.ts`,
    importSource: "@/components/navigation",
    name: "useAppRouter",
  },
}) => {
  const featureKitConfig = createExpoFeatureKitConfig({
    cwd,
    sourceRoot,
    moduleRoots,
    additionalRoles,
    allowedFolders,
  });

  const featureGraphqlPlugin = createFeatureGraphqlPlugin(cwd, {
    moduleRoots,
    ...graphql,
  });

  return [
    ...commonConfig,
    {
      ignores: moduleRoots.map((root) => `${root}/*/generated/**`),
    },
    {
      files: [`${sourceRoot}/**/*.{gql,graphql}`],
      plugins: {
        "feature-graphql": featureGraphqlPlugin,
      },
      processor: "feature-graphql/conventions",
    },
    featureKitConfig,
    ...createNavigationConfig(sourceRoot, navigationHook),
    {
      files: [`${sourceRoot}/**/*.tsx`],
      ...reactConfig,
      rules: {
        ...reactConfig.rules,
        "db21-hooks/require-extracted-hooks": "error",
        "no-restricted-syntax": ["error", ...expoRestrictedSyntax],
      },
    },
  ];
};
