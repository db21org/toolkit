import { react, recommended } from "@db21/toolkit/eslint/base";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";

import {
  exportedConstantNamingPlugin,
  multilineConstPaddingPlugin,
  noUnsafeDoubleAssertionPlugin,
  preferAssertionsPlugin,
  preferAwaitedValuesPlugin,
  requireExtractedHooksPlugin,
  typescriptFilenameConventionsPlugin,
} from "./plugins/index.mjs";

const [javascriptRecommended, ...typescriptRecommended] = recommended;

const javascriptFiles = ["**/*.{cjs,js,mjs}"];
const typescriptFiles = ["**/*.{ts,tsx,mts,cts}"];
const sourceFiles = [...javascriptFiles, ...typescriptFiles];

const javascriptRestrictedSyntax = Array.isArray(
  javascriptRecommended.rules?.["no-restricted-syntax"],
)
  ? javascriptRecommended.rules["no-restricted-syntax"].slice(1)
  : [];

export const inheritedRestrictedSyntax = typescriptRecommended.reduce(
  (selectors, config) => {
    const rule = config.rules?.["no-restricted-syntax"];

    return Array.isArray(rule) ? rule.slice(1) : selectors;
  },
  [],
);

export const commonPredicateRestrictedSyntax = [
  {
    selector:
      'BinaryExpression[operator=/^(===|!==|>|>=|<|<=)$/][left.type="MemberExpression"][left.property.name="length"][right.value=0], BinaryExpression[operator=/^(===|!==|>|>=|<|<=)$/][right.type="MemberExpression"][right.property.name="length"][left.value=0]',
    message:
      "Use isEmpty/isNotEmpty from @db21/toolkit/utils instead of length checks.",
  },
  {
    selector:
      'BinaryExpression[operator=/^(===|!==)$/][left.type="Literal"][left.value=""], BinaryExpression[operator=/^(===|!==)$/][right.type="Literal"][right.value=""]',
    message:
      "Use isEmpty/isNotEmpty from @db21/toolkit/utils instead of comparing with an empty string.",
  },
  {
    selector:
      'BinaryExpression[operator=/^(===|!==)$/][left.type="Identifier"][left.name="undefined"], BinaryExpression[operator=/^(===|!==)$/][right.type="Identifier"][right.name="undefined"]',
    message:
      "Use isDefined/isNotDefined from @db21/toolkit/utils instead of comparing with undefined.",
  },
  {
    selector:
      'BinaryExpression[operator=/^(===|!==)$/][left.type="Literal"][left.value=null], BinaryExpression[operator=/^(===|!==)$/][right.type="Literal"][right.value=null]',
    message:
      "Use isDefined/isNotDefined from @db21/toolkit/utils instead of comparing with null.",
  },
  {
    selector:
      'UnaryExpression[operator="!"] > CallExpression[callee.name=/^(isDefined|isNotDefined|isEmpty|isNotEmpty)$/]',
    message:
      "Use the existing opposite predicate instead of negating a shared predicate.",
  },
];

export const reactHookRules = Object.fromEntries(
  Object.entries(react.rules ?? {}).filter(([name]) =>
    name.startsWith("react-hooks/"),
  ),
);

export const reactConfig = react;

export const sonarRules = {
  "sonarjs/no-all-duplicated-branches": "error",
  "sonarjs/no-duplicated-branches": "error",
  "sonarjs/no-element-overwrite": "error",
  "sonarjs/no-empty-collection": "error",
  "sonarjs/no-gratuitous-expressions": "error",
  "sonarjs/no-identical-conditions": "error",
  "sonarjs/no-identical-expressions": "error",
  "sonarjs/no-redundant-assignments": "error",
  "sonarjs/no-redundant-jump": "error",
  "sonarjs/no-use-of-empty-return-value": "error",
  "sonarjs/cognitive-complexity": ["warn", 15],
  "sonarjs/no-dead-store": "warn",
  "sonarjs/no-ignored-exceptions": "warn",
};

export const typescriptSonarRules = {
  "sonarjs/no-ignored-return": "warn",
  "sonarjs/null-dereference": "warn",
};

export const unicornRules = {
  "unicorn/consistent-boolean-name": [
    "error",
    {
      checkArguments: "prohibit",
      checkFunctions: "prohibit",
      checkVariables: "prohibit",
    },
  ],
  "unicorn/error-message": "error",
  "unicorn/no-abusive-eslint-disable": "error",
  "unicorn/no-array-fill-with-reference-type": "error",
  "unicorn/no-array-reverse": ["error", { allowExpressionStatement: false }],
  "unicorn/no-array-sort": ["error", { allowExpressionStatement: false }],
  "unicorn/no-async-promise-finally": "error",
  "unicorn/no-await-expression-member": "error",
  "unicorn/no-await-in-promise-methods": "error",
  "unicorn/no-boolean-sort-comparator": "error",
  "unicorn/no-invalid-fetch-options": "error",
  "unicorn/no-invalid-remove-event-listener": "error",
  "unicorn/no-multiple-promise-resolver-calls": "error",
  "unicorn/no-single-promise-in-promise-methods": "error",
  "unicorn/no-unsafe-promise-all-settled-values": "error",
  "unicorn/no-unused-array-method-return": "error",
  "unicorn/prefer-node-protocol": "error",
  "unicorn/prefer-string-replace-all": "error",
  "unicorn/prefer-structured-clone": "error",
  "unicorn/require-array-sort-compare": "error",
  "unicorn/throw-new-error": "error",
};

export const typescriptRepositoryPlugins = {
  "db21-assertions": preferAssertionsPlugin,
  "db21-await": preferAwaitedValuesPlugin,
  "db21-constants": exportedConstantNamingPlugin,
  "db21-filenames": typescriptFilenameConventionsPlugin,
  "db21-hooks": requireExtractedHooksPlugin,
  "db21-padding": multilineConstPaddingPlugin,
  "db21-types": noUnsafeDoubleAssertionPlugin,
};

export const typescriptRepositoryRules = {
  "db21-assertions/prefer-assertions": "error",
  "db21-await/prefer-awaited-values": "error",
  "db21-filenames/typescript-filename": "error",
  "db21-padding/multiline-const-padding": "error",
  "@typescript-eslint/no-extraneous-class": [
    "error",
    { allowStaticOnly: true, allowWithDecorator: true },
  ],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-nested-ternary": "error",
  "no-restricted-syntax": [
    "error",
    ...inheritedRestrictedSyntax,
    ...commonPredicateRestrictedSyntax,
    {
      selector: "TSUnionType > TSNullKeyword",
      message:
        "Use Maybe<T> from @db21/toolkit/utils instead of explicit `| null` unions.",
    },
  ],
};

export const commonConfig = [
  {
    ignores: [
      "**/.astro/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/dist-dev/**",
      "**/node_modules/**",
      ".yarn/**",
    ],
  },
  javascriptRecommended,
  {
    files: sourceFiles,
    plugins: { sonarjs, unicorn },
    rules: { ...sonarRules, ...unicornRules },
  },
  {
    files: ["**/src/generated/**/*.{cjs,js,mjs,ts,tsx,mts,cts}"],
    rules: { "unicorn/no-abusive-eslint-disable": "off" },
  },
  {
    files: javascriptFiles,
    languageOptions: {
      globals: {
        __dirname: "readonly",
        Buffer: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    plugins: {
      "db21-assertions": preferAssertionsPlugin,
      "db21-await": preferAwaitedValuesPlugin,
      "db21-padding": multilineConstPaddingPlugin,
    },
    rules: {
      "db21-assertions/prefer-assertions": "error",
      "db21-await/prefer-awaited-values": "error",
      "db21-padding/multiline-const-padding": "error",
      "no-nested-ternary": "error",
      "no-restricted-syntax": [
        "error",
        ...javascriptRestrictedSyntax,
        ...commonPredicateRestrictedSyntax,
      ],
    },
  },
  ...typescriptRecommended.map((config) => ({
    ...config,
    files: config.files ?? typescriptFiles,
  })),
  {
    files: typescriptFiles,
    plugins: typescriptRepositoryPlugins,
    rules: { ...typescriptRepositoryRules, ...typescriptSonarRules },
  },
  {
    files: ["**/src/**/generated/**/*.{ts,tsx,mts,cts}"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["**/src/**/*.{ts,tsx,mts,cts}"],
    ignores: [
      "**/src/**/generated/**",
      "**/src/**/test/**",
      "**/src/**/*.test.{ts,tsx,mts,cts}",
      "**/src/**/*.test-helpers.{ts,tsx,mts,cts}",
    ],
    rules: {
      "db21-types/no-unsafe-double-assertion": "error",
    },
  },
  {
    files: typescriptFiles,
    ignores: [
      "**/generated/**",
      "**/test/**",
      "**/*.fixture.{ts,tsx,mts,cts}",
      "**/*.test.{ts,tsx,mts,cts}",
      "**/*.test-helpers.{ts,tsx,mts,cts}",
    ],
    rules: {
      "db21-constants/exported-constant-naming": "error",
    },
  },
];

export const reactPackageConfig = [
  ...commonConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: react.plugins,
    rules: reactHookRules,
  },
  {
    files: ["**/*.tsx"],
    ...react,
    rules: {
      ...react.rules,
      "db21-hooks/require-extracted-hooks": "error",
    },
  },
];

export default commonConfig;
