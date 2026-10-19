# ESLint Rules

This document describes the rules exported by `@db21/toolkit/eslint/base` and shows valid/invalid examples. Keep it in sync with `src/eslint/base/rules.ts`, `src/eslint/base/react-conventions.ts`, and the tests under `test/eslint-base/`.

## Base `recommended` rules

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
