import type { ESLint, Linter } from "eslint";

import { reactConventionsPlugin } from "./react-conventions.js";
import { reactComponentRules } from "./rules.js";

export const react = {
  plugins: {
    "react-conventions": reactConventionsPlugin as ESLint.Plugin,
  },
  rules: reactComponentRules,
} satisfies Linter.Config;

export { reactComponentRules, reactConventionsPlugin };
