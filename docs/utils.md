# @db21/toolkit/utils

Small, framework-agnostic utility primitives shared at the package boundary, including runtime assertions.

## Public API

- `Maybe<Value>`
- `assert`
- `isDefined(value)`
- `isNotDefined(value)`
- `isEmpty(value)`
- `isNotEmpty(value)`

## Assertions

```ts
import { assert } from "@db21/toolkit/utils";

const formatEnv = (value: unknown) => {
  assert.defined(value, "Missing required environment variable value");

  return value;
};

const ensureNullish = (value: unknown) => {
  assert.notDefined(value, new Error("Expected value to be nullish"));

  return value;
};

const shouldRenderFeature = (value: unknown) => {
  assert.true(value === "enabled", "Feature flag must be enabled");
  assert.false(value === "disabled", "Feature flag must not be disabled");

  return value;
};
```

- `assert.defined(value, failure)`: throws when `value` is `null` or `undefined`; on success it narrows to a non-nullish type.
- `assert.notDefined(value, failure)`: throws when `value` is not `null`/`undefined`; accepts only nullish values.
- `assert.true(value, failure)`: throws unless `value` is exactly `true`; on success it narrows to `true`.
- `assert.false(value, failure)`: throws unless `value` is exactly `false`.
- `failure` is required and must be an `Error` or a `string`.
- String failures are converted to `Error` instances before throwing; existing `Error` instances are preserved.
- `null` and `undefined` are considered “not defined”.

## Package surface

This subpath is shipped as dual-entry module output:

- ESM: `./dist/utils/index.js` with `./dist/utils/index.d.ts`
- CommonJS: `./dist/utils/index.cjs` with `./dist/utils/index.d.cts`

Node ESM consumers resolve through the `import` path, and Node CJS consumers resolve through the `require` path.

## Workspace/build notes

- Run `corepack yarn build` explicitly after installation; installation does not build or publish anything.
- `ignoreDeprecations: "6.0"` is kept temporarily for tsup's declaration builder because it injects deprecated `baseUrl` internally; package source config does not use `baseUrl`.
- Build artifacts are emitted to `dist` and are not committed to source control.
