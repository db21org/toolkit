import {
  logicalChecksPlugin,
  namedArraysPlugin,
  namedNumbersPlugin,
  preferConditionValuesPlugin,
} from "@db21/toolkit/eslint/plugins";
import type { ESLint, Linter } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";

import { reactConventionsPlugin } from "./react-conventions.js";
import { reactComponentRules, recommendedRules } from "./rules.js";

export const reactRestrictedSyntax = [
  {
    selector:
      'JSXExpressionContainer > ConditionalExpression[consequent.type="Literal"][consequent.value=null], JSXExpressionContainer > ConditionalExpression[alternate.type="Literal"][alternate.value=null]',
    message:
      "Use condition && <Component /> rendering instead of JSX ternaries that return null.",
  },
  {
    selector: 'JSXExpressionContainer > Literal[value=" "]',
    message:
      "Do not use JSX space expressions. Include spacing in text or layout instead.",
  },
];

export const react = {
  plugins: {
    ...reactHooks.configs.flat.recommended.plugins,
    "db21-arrays": namedArraysPlugin,
    "db21-conditions": preferConditionValuesPlugin,
    "db21-logic": logicalChecksPlugin,
    "db21-numbers": namedNumbersPlugin,
    "react-conventions": reactConventionsPlugin as ESLint.Plugin,
  },
  rules: {
    ...reactHooks.configs.flat.recommended.rules,
    ...reactComponentRules,
    "db21-arrays/no-inline-member-access": "error",
    "db21-conditions/prefer-named-values": "error",
    "db21-logic/max-checks": "error",
    "db21-numbers/no-magic-numbers": "error",
    "no-restricted-syntax": [
      "error",
      ...recommendedRules["no-restricted-syntax"].slice(1),
      ...reactRestrictedSyntax,
    ],
  },
} satisfies Linter.Config;

export { reactComponentRules, reactConventionsPlugin };
