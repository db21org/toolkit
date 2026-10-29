# ESLint Rules

This document describes the rules exported by `@db21/toolkit/eslint/base` and shows valid/invalid examples. Keep it in sync with `src/eslint/base/rules.ts`, `src/eslint/base/react-conventions.ts`, and the tests under `test/eslint-base/`.

## Base `recommended` rules

Shared plugins and readability rules live in the base presets. Both
`javascriptRecommended` and `typescriptRecommended` compose the same shared policy.
The base `react` export is an overlay: use it after `recommended`, not alone.
`@db21/toolkit/eslint/react` and the Expo preset already compose the common preset
before React-specific rules. Astro also composes the common preset for JS/TS files;
its `.astro` files use a separate parser and policy overlay.

Flat config replaces rule options rather than merging them. Specialized presets
therefore explicitly combine inherited `no-restricted-syntax` selectors with their
own selectors so shared restrictions remain enforced.

### `db21-conditions/prefer-named-values`

Assign calls receiving inline callbacks to meaningful named constants before using
their results in `if`, `while`, `do...while`, `for` tests, ternary tests or `switch`
discriminants. Simple predicates and named callbacks remain allowed. This rule
does not cover returns, switch case labels, loop initializers/updates or branch
bodies. Nested callback bodies are independent evaluation scopes.

Preserve short-circuit evaluation: do not eagerly compute a callback call that was
guarded by another condition. Loop tests must recompute their results on every
check, not reuse a constant computed before the loop. No autofix is provided.

Valid:

```ts
const hasProduct = page.products.some(({ id }) => id === productId);

if (!hasProduct) {
  handleMissingProduct();
}
```

Invalid:

```ts
if (!page.products.some(({ id }) => id === productId)) {
  handleMissingProduct();
}
```

### `db21-arrays/no-inline-member-access`

Extract array literals into meaningfully named constants before member access.
This covers method calls, indexes, properties such as `.length`, optional chaining
and TypeScript assertion wrappers. Comments do not exempt these expressions.
Array declarations, arguments, returns and destructuring remain allowed.

Keep initialization in the same evaluation scope: hoisting arrays can change
mutation, allocation and side-effect behavior. No autofix is provided.
The numeric-literal rule still applies independently to array elements.

Valid:

```ts
const validationStatuses = [badRequest, conflict, unprocessable];
validationStatuses.some((status) => error.status === status);
```

Invalid:

```ts
[badRequest, conflict, unprocessable].some((status) => error.status === status);
[first, second][index];
[first, second].length;
```

### `db21-numbers/no-magic-numbers`

Give numeric literals meaningful names or attach a comment explaining their meaning.
Applies to decimal, hex, binary, octal, fractional and bigint values, even when used
only once. `-1`, `0` and `1` (including bigint equivalents) are exempt. Strings are
outside this rule's scope.

Direct named variable initializers, named class fields, enum members and numeric
literal types are allowed. Numeric values inside expressions, arrays, object
properties, arguments, returns and indexes still need names or explanations.
Comments may be inline next to the value, immediately above the containing
statement, or on the same line after that statement. Empty comments, lint/type
directives, detached comments and comments belonging to other statements do not
qualify. Lint checks comment presence, not whether its explanation is meaningful.
No autofix is provided.

Valid:

```ts
const supplementaryPlaneStart = 0x10000;
const maxUnicodeCodePoint = 0x10ffff;
const isSupplementary =
  codePoint >= supplementaryPlaneStart && codePoint <= maxUnicodeCodePoint;

// Supplementary Unicode plane bounds.
const isSupplementaryWithComment =
  codePoint >= 0x10000 && codePoint <= 0x10ffff;
```

Invalid:

```ts
const isSupplementary = codePoint >= 0x10000 && codePoint <= 0x10ffff;
scheduleRetry(500);
```

### `@typescript-eslint/consistent-type-assertions`

Use `as` assertions.

Valid:

```ts
const input = "value" as unknown as string;
```

Invalid:

```ts
const input = <string>value;
```

### `@typescript-eslint/consistent-type-definitions`

Use `type` aliases for object shapes.

Valid:

```ts
type User = { name: string };
```

Invalid:

```ts
interface User {
  name: string;
}
```

### `@typescript-eslint/explicit-function-return-type`

Annotate function return types unless the function expression is already typed.

Valid:

```ts
const getValue = (): number => 1;
```

Invalid:

```ts
const getValue = () => 1;
```

### `@typescript-eslint/no-explicit-any`

Use safer types instead of `any`.

Valid:

```ts
const value: unknown = "value";
```

Invalid:

```ts
const value: any = "value";
```

### `@typescript-eslint/strict-boolean-expressions`

Use explicit boolean comparisons; do not rely on truthiness for strings, numbers, nullable values, objects, or `any`.

Valid:

```ts
const value: string = "";

if (value !== "") {
  run();
}
```

Invalid:

```ts
const value: string = "";

if (value) {
  run();
}
```

### `@typescript-eslint/no-inferrable-types`

This rule is disabled. Explicit primitive annotations are allowed.

Allowed:

```ts
const count: number = 1;
```

### `@typescript-eslint/parameter-properties`

Prefer constructor parameter properties.

Valid:

```ts
class User {
  public constructor(private readonly id: string) {}
}
```

Invalid:

```ts
class User {
  private readonly id: string;

  public constructor(id: string) {
    this.id = id;
  }
}
```

### `@typescript-eslint/prefer-nullish-coalescing`

Use `??` for nullish fallback expressions. Boolean operators should be used for boolean logic, not value fallback.

Valid:

```ts
const input: string | null = null;
const value = input ?? "fallback";
```

Invalid:

```ts
const input: string | null = null;
const value = input || "fallback";
```

### `@typescript-eslint/restrict-template-expressions`

Only use string-compatible values in template expressions. Do not interpolate objects directly.

Valid:

```ts
const value: string = "ok";
const text = `${value}`;
```

Invalid:

```ts
const value: object = {};
const text = `${value}`;
```

### `brace-style`

Use one true brace style (`1tbs`).

Valid:

```ts
if (ready) {
  run();
} else {
  stop();
}
```

Invalid:

```ts
if (ready) {
  run();
} else {
  stop();
}
```

### `curly`

Always use braces for control statements.

Valid:

```ts
if (enabled) {
  run();
}
```

Invalid:

```ts
if (enabled) run();
```

### `jsdoc/require-jsdoc`

Require JSDoc for public function declarations, class declarations, and methods.

Valid:

```ts
/** Does work. */
export function doWork(): void {}
```

Invalid:

```ts
export function doWork(): void {}
```

### `jsdoc/require-param`

Require `@param` tags for normal TypeScript functions/methods with parameters.

Valid:

```ts
/**
 * Does work.
 * @param value
 */
export function doWork(value: string): void {}
```

Invalid:

```ts
/** Does work. */
export function doWork(value: string): void {}
```

### `jsdoc/require-param-description`

Require descriptions for `@param` tags.

Valid:

```ts
/**
 * Does work.
 * @param value Value to process.
 */
export function doWork(value: string): void {}
```

Invalid:

```ts
/**
 * Does work.
 * @param value
 */
export function doWork(value: string): void {}
```

### `jsdoc/require-returns`

Require `@returns` tags for functions that return a value.

Valid:

```ts
/**
 * Does work.
 * @returns Result text.
 */
export function doWork(): string {
  return "ok";
}
```

Invalid:

```ts
/** Does work. */
export function doWork(): string {
  return "ok";
}
```

### `jsdoc/tag-lines`

This rule is disabled. Flexible spacing between description and tags is allowed.

Allowed:

```ts
/**
 * Does work.
 *
 * @returns value
 */
export function doWork(): string {
  return "ok";
}
```

### `max-lines-per-function`

Warn when a function exceeds 60 non-blank, non-comment lines.

Valid:

```ts
function shortTask(): void {
  run();
}
```

Invalid:

```ts
function longTask(): void {
  step1();
  // ...more than 60 executable lines...
}
```

### `no-restricted-imports`

Avoid multi-level parent imports. Move related files closer together or use a meaningful path alias/module boundary.

Valid:

```ts
import { Button } from "../Button";
import { formatName } from "@/shared/formatName";
```

Invalid:

```ts
import { formatName } from "../../shared/formatName";
```

### `no-restricted-syntax`

Disallow selected syntax patterns:

- `#private` fields. Use TypeScript `private`/`protected` instead.
- Class fields starting with `$` or `_`. Use visibility modifiers instead.
- `await` directly inside conditions. Assign awaited values to named constants before the condition.

Valid:

```ts
class User {
  private id = "1";
}
```

Invalid:

```ts
class User {
  #id = "1";
}
```

### `padding-line-between-statements`

Require blank lines between declarations and following statements, before control-flow/return/throw, and around blocks.

Valid:

```ts
const value = 1;

returnValue(value);
```

Invalid:

```ts
const value = 1;
returnValue(value);
```

### `preserve-caught-error`

This rule is disabled. Throwing a new error without preserving the caught error is allowed.

Allowed:

```ts
try {
  run();
} catch (error) {
  throw new Error("Failed");
}
```

### `simple-import-sort/imports`

Sort imports.

Valid:

```ts
import a from "a";
import b from "b";
```

Invalid:

```ts
import b from "b";
import a from "a";
```

### `simple-import-sort/exports`

Sort exports.

Valid:

```ts
export { a } from "./a";
export { b } from "./b";
```

Invalid:

```ts
export { b } from "./b";
export { a } from "./a";
```

## Base file-size rule

### `max-lines`

Warn when TypeScript files exceed 300 non-blank, non-comment lines.

Valid:

```ts
const one = 1;
```

Invalid:

```ts
const value1 = 1;
// ...more than 300 non-blank, non-comment lines...
```

## Opt-in `react` rules

The `react` config is separate from `recommended`. Consumers should apply it only to TSX files they choose, for example:

```js
import { react, recommended } from "@db21/toolkit/eslint/base";

export default [
  ...recommended,
  {
    files: ["src/web/**/*.tsx"],
    ...react,
  },
];
```

### `react-hooks/refs`: render-prop analysis limitation

The React overlay inherits this rule from `eslint-plugin-react-hooks`' recommended
config. Toolkit does not replace its analysis or exempt render props.

With `eslint-plugin-react-hooks@7.1.1`, passing a ref-accessing callback through an
object to a render-time function can report `Cannot access refs during render`:

```tsx
const show = useCallback(() => {
  clearTimeout(timer.current);
  setVisible(true);
}, []);

return <>{renderTrigger({ show })}</>;
```

This can be safe when every consumer only registers the callback for later use:

```tsx
<Tooltip
  renderTrigger={({ show }) => <button onClick={show}>Show tooltip</button>}
/>
```

But the same component API also permits a real render-time violation:

```tsx
<Tooltip
  renderTrigger={({ show }) => {
    show(); // Unsafe: accesses the ref during render.
    return <button>Show tooltip</button>;
  }}
/>
```

The upstream analysis tracks ref effects inside callbacks and through argument
objects. It conservatively flags the call because the renderer could invoke
`show` immediately. It does not specialize the component's prop analysis from its
JSX consumers; putting both components in one file does not resolve this example.
A `() => void` TypeScript signature does not guarantee deferred execution. Even a
known local renderer that only assigns the handler reproduces this limitation in
7.1.1; this is not a claim that all local call-chain analysis is unsupported.

Do not disable the rule globally or exempt calls based on names such as
`renderTrigger`. If all consumers have been audited and the API contract forbids
calling the handler during render, isolate the call and suppress only its line:

```tsx
// eslint-disable-next-line react-hooks/refs -- Audited renderTrigger consumers only attach show as an event handler; none call it during render.
const trigger = renderTrigger({ show });

return <>{trigger}</>;
```

This suppression does not prove safety and hides future violations at that call.
Keep the deferred-execution contract explicit and recheck consumers when they
change. Do not use it for unknown or externally supplied renderers whose behavior
cannot be audited. Direct `<button onClick={show}>` usage needs no suppression;
direct calls such as `show()` during render must remain errors.

See React's [`refs` rule documentation](https://react.dev/reference/eslint-plugin-react-hooks/lints/refs).

### `jsdoc/require-description`

React component JSDoc must include a purpose description.

Valid:

```tsx
/** Describes the component purpose. */
export const Button = () => null;
```

Invalid:

```tsx
/** @deprecated Use LinkButton. */
export const Button = () => null;
```

### React-specific `jsdoc/require-jsdoc`

Require JSDoc on directly exported PascalCase arrow-function components.

Valid:

```tsx
/** Describes the component purpose. */
export const Button = () => null;
```

Invalid:

```tsx
export const Button = () => null;
```

### React-specific `jsdoc/require-param`

This rule is disabled for React components. Document component purpose in the component JSDoc and document non-obvious props on the props type.

Allowed:

```tsx
/** Describes the component purpose. */
export const Button = (props: ButtonProps) => null;
```

### React-specific `jsdoc/require-returns`

This rule is disabled for React components. Component return values are implied by React, so `@returns` tags are not required.

Allowed:

```tsx
/** Describes the component purpose. */
export const Button = () => null;
```

### React-specific `jsdoc/no-restricted-syntax`

Do not use `@param` or `@returns` tags in React component JSDoc.

Valid:

```tsx
/** Describes the component purpose. */
export const Button = () => null;
```

Invalid:

```tsx
/**
 * Describes the component purpose.
 * @param props Component props.
 */
export const Button = (props: ButtonProps) => null;
```

```tsx
/**
 * Describes the component purpose.
 * @returns Root React application element.
 */
export const App = () => null;
```

### `react-conventions/component-style`

React components should be directly exported typed const arrow functions annotated with `FC<Props>` or `React.FC<Props>`.

Valid:

```tsx
import type { FC } from "react";

type ButtonProps = {
  label: string;
};

export const Button: FC<ButtonProps> = () => null;
```

Invalid:

```tsx
export function Button() {
  return null;
}
```

```tsx
import type { FC } from "react";

type ButtonProps = {
  label: string;
};

const Button: FC<ButtonProps> = () => null;
```

```tsx
export const Button = () => null;
```

### `react-conventions/no-imported-props-types`

Declare component props types in the same file as the component that owns them.

Valid:

```tsx
import type { ButtonOptions } from "./button";

type ButtonProps = {
  label: string;
};
```

Invalid:

```tsx
import type { ButtonProps } from "./Button";
```

### `react-conventions/one-component-per-file`

Prefer one React component per file.

Valid:

```tsx
export const Button = () => null;

const formatLabel = () => "Label";
```

Invalid:

```tsx
export const Button = () => null;
export const ButtonIcon = () => null;
```
