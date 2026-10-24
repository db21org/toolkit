import type { ESLint, Linter } from "eslint";

import { reactConventionsPlugin } from "./react-conventions.js";
import { reactComponentRules, recommendedRules } from "./rules.js";

export const reactRestrictedSyntax = [
  {
    selector: 'JSXExpressionContainer > Literal[value=" "]',
    message:
      "Do not use JSX space expressions. Include spacing in text or layout instead.",
  },
];

export const react = {
  plugins: {
    "react-conventions": reactConventionsPlugin as ESLint.Plugin,
  },
  rules: {
    ...reactComponentRules,
    "no-restricted-syntax": [
      "error",
      ...recommendedRules["no-restricted-syntax"].slice(1),
      ...reactRestrictedSyntax,
    ],
  },
} satisfies Linter.Config;

export { reactComponentRules, reactConventionsPlugin };
