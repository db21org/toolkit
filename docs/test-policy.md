# Test justification policy

Shared ESLint presets report every recognized test declaration as an error.
Assess value **before writing tests**, not only when lint fails. Choose to retain,
consolidate, remove, or defer. Never mechanically delete tests or add exceptions.

## Decision checklist

1. **Risk:** identify concrete failure impact: critical business logic, security,
   data integrity, concurrency, public compatibility, or meaningful infrastructure
   failure. Coverage percentages and test counts are not goals.
2. **Contract:** exercise public inputs, outputs, or observable effects. Avoid
   private state, internal call sequences, source-text checksums, or snapshots that
   merely copy implementation. A documented interaction can itself be a contract
   (for example, not charging twice).
3. **Resilience:** assertions should survive behavior-preserving refactors.
   Investigate real regressions first. If behavior remains correct, remove coupling,
   consolidate, or remove low-value coverage; do not mechanically update expected
   values. Changed requirements may legitimately require changed tests. Setup
   adjustments alone do not make a test worthless.
4. **Distinct value:** reuse existing coverage. Additional unit/integration coverage
   needs meaningful extra edge cases, better failure isolation, or substantially
   faster reliable feedback on critical logic. Skip duplicate happy-path smoke
   tests, trivial wrappers, and tests of unmodified upstream library behavior.
5. **Appropriate level:** use the smallest test that realistically detects failure.
   Database locking, SQL semantics, and migrations need real database integration,
   not mocked query calls. Mock external boundaries when useful; do not recreate
   production algorithms in mocks or expected-value calculations.
6. **Reliability:** control time/randomness and external dependencies. Tests should
   be deterministic, isolated, focused, and produce actionable failures. Assert
   independently derived expectations, not the same algorithm as production.

## React and tool selection

Defer **all new React rendering tests**, including reusable-library context,
provider lifecycle, and Suspense contracts, until browser tooling is available.
Continue testing meaningful pure, non-rendering business logic. Existing React
tests remain pending individual review: this is not an instruction to delete them.
Playwright setup is out of scope; do not install it to satisfy this policy.

Jest/Vitest are runners, not inherently unsuitable for React. Rendering fidelity
and observable behavior determine tool suitability. Testing Library can support
user-facing component behavior, but this repository's current decision is to defer
new rendering tests rather than introduce them as a substitute for browser tests.

## Required local assessment

Each exception must name `Risk: …; Contract: …`, in that order, with at least ten
characters in each field. Name specific impact and observable guarantee; generic
claims such as “important test” or “regression coverage” do not justify retention.

```ts
// eslint-disable-next-line db21-tests/require-justification -- Risk: expired tokens grant unauthorized access; Contract: expired credentials are rejected at the authorization boundary.
test("rejects expired tokens", () => {
  // Assertions exercising that boundary.
});
```

`db21-tests/require-local-reason` rejects file-wide exceptions for this rule and
local exceptions missing the required Risk/Contract structure. Use
`eslint-disable-next-line` or `eslint-disable-line` for each declaration, not a
suite-wide disable. One parameterized declaration needs one justification.
Inline `/* eslint ... */` configurations must not disable or downgrade the test
justification rule, including numeric and array severity forms. Keeping it at
`error` is allowed and still requires a local explanation for each test.

Detection covers `test`/`it` globals in test/spec files and test directories,
named imports (including aliases), namespace imports from Vitest/Jest/Node test
modules, and Node's default test import. Modifiers and parameterized `.each`,
`.for`, `.skipIf`, and `.runIf` invocations are included. Suites and builder calls
are not tests. Locally shadowed names and imports from unrelated libraries are
excluded. Custom wrappers, CommonJS bindings, and dynamically extended test
aliases are not inferred; use recognized imports when declaring tests.

Lint enforces an explicit review decision, not the truth of its explanation.
Reviewers still decide whether the test matters. The rule never removes or
justifies tests automatically. Syntax validation cannot establish whether a risk
is genuine. Do not bulk-convert old explanations: reassess each test first.
New workspaces omit placeholder tests and accept
an empty suite until behavior worth protecting exists.

## Examples of assessment

- **Keep:** money rounding at a documented currency boundary; assert independently
  calculated output, not internal decimal-library calls.
- **Keep:** retrying a payment must not create a second charge; observe persisted
  charge count through an appropriate integration boundary.
- **Consolidate:** another identical happy-path unit test already covered without
  distinct edge cases or useful faster feedback.
- **Remove after review:** a wrapper test only verifies that it forwards arguments
  to an upstream function, with no meaningful contract of its own.
- **Redesign:** a test fails when a private helper is renamed although public
  behavior stays correct. Protect the public outcome instead.
- **Defer:** a component-state test proposed as a substitute for future real-browser
  validation. Keep any valuable non-rendering domain logic separately testable.

## Agent instructions

Run `yarn toolkit agents init [directory]` in an existing repository to create
`AGENTS.md` or append a marked section without replacing existing guidance.
Repeated runs leave an existing marked section unchanged. The link targets
`node_modules/@db21/toolkit/docs/test-policy.md`, shipped in the npm package.
Install toolkit in the target repository with a node_modules linker; `yarn dlx`
alone does not provide a lasting policy reference. The command does not install
dependencies, configure ESLint, migrate exceptions, or update existing sections.
Generated workspaces include the same section from the start.

## Background

- [Google: change-detector tests considered harmful](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)
- [Google: effective testing](https://testing.googleblog.com/2014/05/testing-on-toilet-effective-testing.html)
- [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/)
