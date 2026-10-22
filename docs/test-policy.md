# Test justification policy

Shared ESLint presets report every recognized test declaration as an error. Agents
must decide whether to remove an unnecessary test or retain a critical one with a
local exception explaining its specific risk, invariant, or known regression.
Coverage alone is not a reason to retain a test. Never remove tests mechanically.

```ts
// eslint-disable-next-line db21-tests/require-justification -- Security regression: expired tokens previously granted access; protects authorization boundary.
test("rejects expired tokens", () => {
  // Assertions exercising that boundary.
});
```

`db21-tests/require-local-reason` rejects file-wide exceptions for this rule and
local exceptions without a description of at least 20 characters. Use
`eslint-disable-next-line` or `eslint-disable-line` for each declaration, not a
suite-wide disable. One parameterized declaration needs one justification.

Detection covers `test`/`it` globals in test/spec files and test directories,
named imports (including aliases), namespace imports from Vitest/Jest/Node test
modules, and Node's default test import. Modifiers and parameterized `.each`,
`.for`, `.skipIf`, and `.runIf` invocations are included. Suites and builder calls
are not tests. Locally shadowed names and imports from unrelated libraries are
excluded. Custom wrappers, CommonJS bindings, and dynamically extended test
aliases are not inferred; use recognized imports when declaring tests.

Lint enforces an explicit review decision, not the truth of its explanation.
Reviewers still decide whether the test matters. The rule never removes or
justifies tests automatically. New workspaces omit placeholder tests and accept
an empty suite until behavior worth protecting exists.
