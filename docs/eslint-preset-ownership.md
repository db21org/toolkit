# ESLint preset ownership

## Shared layers

- **Base JS/TS:** braces, spacing, imports, JSDoc, size limits and refactoring
  guidance. Type-aware checks and TypeScript visibility syntax stay TypeScript-only.
- **Repository common:** toolkit predicates, assertions, awaited values, filenames,
  type aliases, constants, Prisma boundaries, SQL justification and test assessment.
  These do not depend on React, Nest or Feature Kit.
- **Base React:** component declarations, props ownership, one component per file,
  component documentation, JSX-space prohibition and a 150-line function limit.
  Apply this unscoped configuration to component files, as the public React and
  Expo presets already do for `.tsx`. Other files keep the shared 60-line limit.
- **React package:** common repository policy plus React component rules and
  component-file hook extraction. The React rule set composes repository syntax
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

## Recommendations requiring a separate decision

1. **JSX null ternaries:** Expo currently prefers `condition && <Component />`
   over ternaries returning `null`. This is generic React style, so React is the
   better owner if the preference should apply to all React consumers. Moving it
   would introduce a new restriction outside Expo; it remains unchanged here.
2. **React Hooks correctness:** `reactHookRules` currently selects no rules because
   the base React config contains only the toolkit conventions plugin. Neither
   `react-hooks/rules-of-hooks` nor `react-hooks/exhaustive-deps` is enabled.
   The hook-extraction rule is not a replacement. Add an approved React Hooks
   dependency and choose its policy in shared React, then let Expo inherit it.
3. **Private utility extraction:** this rule has no intrinsic Nest dependency but
   is enabled only by the Nest profile. Moving it into common would impose
   `utils/*.util.ts` layout on React, scripts and toolkit internals. Prefer an
   explicit reusable layout-policy option if broader adoption is desired, rather
   than silently enabling it everywhere.

No dependency, consumer configuration or additional policy scope changes were
made for these recommendations. Expo i18n/NativeWind defaults and Feature Kit
module conventions are opt-in profile choices, not suitable universal defaults.
