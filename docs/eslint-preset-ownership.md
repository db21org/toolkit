# ESLint preset ownership

## Shared layers

- **Base JS/TS:** braces, spacing, imports, JSDoc, size limits and refactoring
  guidance. Type-aware checks and TypeScript visibility syntax stay TypeScript-only.
- **Repository common:** toolkit predicates, assertions, awaited values, filenames,
  type aliases, constants, Prisma boundaries, SQL justification and test assessment.
  These do not depend on React, Nest or Feature Kit.
- **Base React:** component declarations, props ownership, one component per file,
  component documentation, JSX-space/null-ternary prohibitions, full recommended
  React Hooks policy and a 150-line function limit.
  Apply this unscoped configuration to component files, as the public React and
  Expo presets already do for `.tsx`. Other files keep the shared 60-line limit.
- **React package:** common repository policy plus React component rules and
  component-file hook extraction. Hook correctness also applies to ordinary `.ts`
  files in the React and Expo profiles. The React rule set composes repository syntax
  restrictions rather than replacing them.
- **Expo:** React component policy plus application-specific localization,
  NativeWind, navigation and GraphQL conventions. Its final component block must
  retain these restrictions when composing React rules.
- **Nest:** common repository policy plus private utility extraction and the Nest
  Feature Kit profile. DTO naming belongs in the Nest-specific Feature Kit layer.
- **Astro:** common script policy plus Astro parsing and template rules. It does not
  inherit React component rules: Astro templates are not React components.
- **Feature Kit core/React/Nest:** module ownership, role filenames and dependency
  boundaries. React providers/Surfaces and Nest DTOs remain in their respective
  profiles, not framework-agnostic core or ordinary React configuration.

The JSX-space prohibition and 150-line allowance now live in React, not Expo.
Limits remain errors; the 300-line file limit remains unchanged. Existing generated
file exceptions and explicit profile overrides remain scoped as before.

## Completed audit follow-ups

- **JSX null ternaries:** React now owns the preference for logical rendering
  rather than ternaries returning `null`; Expo inherits it. This checks syntax,
  not truthiness: use a boolean condition to avoid rendering values such as `0`.
- **React Hooks correctness:** shared React uses
  `eslint-plugin-react-hooks/configs.flat.recommended`, including React Compiler
  diagnostics. Upstream severities remain intact: `exhaustive-deps`,
  `incompatible-library` and `unsupported-syntax` are warnings; the other
  recommended rules are errors. This enables lint diagnostics, not the Compiler
  transform. Hook extraction remains a separate repository layout policy.
- **Private utility extraction:** `createUtilityExtractionConfig` from
  `@db21/toolkit/eslint` exposes the existing TypeScript layout policy as an
  explicit opt-in. Nest uses the same factory, retaining its existing defaults.
  Common, React, Expo and Astro do not enable it automatically.

See [development guidance](development.md#optional-utility-layout) for opt-in
configuration. No consumer configurations changed. Expo i18n/NativeWind defaults
and Feature Kit module conventions remain opt-in profile choices, not suitable
universal defaults.
