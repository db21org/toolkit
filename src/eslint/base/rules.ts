import type { Linter } from "eslint";

const MAX_FILE_LINES = 300;
const MAX_REACT_COMPONENT_LINES = 150;
const MAX_FUNCTION_LINES = 60;

export const maxLinesRules = {
  "max-lines": [
    "error",
    { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: true },
  ],
} satisfies Linter.RulesRecord;

export const reactComponentRules = {
  "max-lines-per-function": [
    "error",
    {
      max: MAX_REACT_COMPONENT_LINES,
      skipBlankLines: true,
      skipComments: true,
    },
  ],
  "jsdoc/no-restricted-syntax": [
    "error",
    {
      contexts: [
        {
          context: "any",
          comment: "JsdocBlock:has(JsdocTag[tag=param])",
          message:
            "Document React components with a purpose description, not destructured props with @param tags. Comment non-obvious props on the props type instead.",
        },
        {
          context: "any",
          comment: "JsdocBlock:has(JsdocTag[tag=returns])",
          message:
            "Document React components with a purpose description, not @returns tags. Component return values are implied by React.",
        },
      ],
    },
  ],
  "jsdoc/require-description": "error",
  "jsdoc/require-jsdoc": [
    "error",
    {
      contexts: [
        "ExportNamedDeclaration:has(VariableDeclarator[id.name=/^[A-Z]/][init.type='ArrowFunctionExpression'])",
      ],
      enableFixer: false,
      require: {
        ArrowFunctionExpression: false,
        ClassDeclaration: false,
        FunctionDeclaration: false,
        FunctionExpression: false,
        MethodDefinition: false,
      },
    },
  ],
  "jsdoc/require-param": "off",
  "jsdoc/require-returns": "off",
  "react-conventions/component-style": "error",
  "react-conventions/no-imported-props-types": "error",
  "react-conventions/one-component-per-file": "error",
} satisfies Linter.RulesRecord;

const typescriptRules = {
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "as", objectLiteralTypeAssertions: "allow" },
  ],
  "@typescript-eslint/consistent-type-definitions": ["error", "type"],
  "@typescript-eslint/explicit-function-return-type": [
    "error",
    {
      allowExpressions: false,
      allowHigherOrderFunctions: false,
      allowTypedFunctionExpressions: true,
    },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/strict-boolean-expressions": [
    "error",
    {
      allowAny: false,
      allowNullableBoolean: false,
      allowNullableEnum: false,
      allowNullableNumber: false,
      allowNullableObject: false,
      allowNullableString: false,
      allowNumber: false,
      allowString: false,
    },
  ],
  "@typescript-eslint/no-inferrable-types": "off",
  "@typescript-eslint/parameter-properties": [
    "error",
    { prefer: "parameter-property" },
  ],
  "@typescript-eslint/prefer-nullish-coalescing": "error",
  "@typescript-eslint/restrict-template-expressions": "error",
} satisfies Linter.RulesRecord;

const commonRestrictedSyntax = [
  {
    selector:
      "Program > :not(ImportDeclaration):not(TSImportEqualsDeclaration):not(ExpressionStatement[directive]) ~ :matches(ImportDeclaration, TSImportEqualsDeclaration)",
    message:
      "Keep static imports at the top of the file, after any directive prologue and before other statements.",
  },
  {
    selector:
      "IfStatement > AwaitExpression.test, IfStatement > UnaryExpression.test AwaitExpression, IfStatement > LogicalExpression.test AwaitExpression, IfStatement > BinaryExpression.test AwaitExpression, IfStatement > ConditionalExpression.test AwaitExpression, IfStatement > CallExpression.test AwaitExpression",
    message:
      "Do not await inside conditions. Assign awaited values to named constants before the condition.",
  },
];

export const commonRules = {
  "brace-style": ["error", "1tbs", { allowSingleLine: false }],
  curly: ["error", "all"],
  "jsdoc/require-jsdoc": [
    "error",
    {
      publicOnly: true,
      require: {
        ArrowFunctionExpression: false,
        ClassDeclaration: true,
        FunctionDeclaration: true,
        FunctionExpression: false,
        MethodDefinition: true,
      },
    },
  ],
  "jsdoc/require-param": "error",
  "jsdoc/require-param-description": "error",
  "jsdoc/require-returns": "error",
  "jsdoc/tag-lines": "off",
  "max-lines-per-function": [
    "error",
    { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true },
  ],
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["../../*", "../../../*", "../../../../*", "../../../../../*"],
          message:
            "Avoid multi-level parent imports. Move related files closer together or use a meaningful path alias/module boundary.",
        },
      ],
    },
  ],
  "no-restricted-syntax": ["error", ...commonRestrictedSyntax],
  "padding-line-between-statements": [
    "error",
    { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
    {
      blankLine: "any",
      prev: ["const", "let", "var"],
      next: ["const", "let", "var"],
    },
    {
      blankLine: "always",
      prev: "*",
      next: ["if", "for", "while", "switch", "try", "return", "throw"],
    },
    { blankLine: "always", prev: ["block", "block-like"], next: "*" },
    { blankLine: "always", prev: "*", next: ["block", "block-like"] },
  ],
  "preserve-caught-error": "off",
  "simple-import-sort/exports": "error",
  "simple-import-sort/imports": "error",
} satisfies Linter.RulesRecord;

export const recommendedRules = {
  ...commonRules,
  ...typescriptRules,
  "no-restricted-syntax": [
    "error",
    ...commonRestrictedSyntax,
    {
      selector: "PrivateIdentifier",
      message:
        "Use TypeScript private/protected fields instead of #private names.",
    },
    {
      selector: "PropertyDefinition > Identifier[name=/^[$_]/]",
      message:
        "Do not prefix class field names. Use private/protected modifiers for visibility.",
    },
  ],
} satisfies Linter.RulesRecord;
