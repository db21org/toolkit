# Native batching before awaited fan-out

Shared JavaScript/TypeScript repository presets enable
`db21-promises/prefer-native-batch` as an error. It rejects direct
`await Promise.all(...)` expressions, including static computed members, optional
calls and TypeScript assertion wrappers.

Prefer an existing native bulk API, such as a single repository query accepting
multiple IDs. Otherwise, consider whether the method owning the operation should
support batching while preserving ordering, error handling, transactions,
concurrency bounds and public behavior. Do not hide the same fan-out in a trivial
wrapper or blindly replace independent concurrent work with serial awaits.

## Necessary concurrency

Use a local exception explaining why batching cannot preserve the required
behavior. For example, a concurrency regression must exercise independent workers:

```ts
// eslint-disable-next-line db21-promises/prefer-native-batch -- Independent workers must race for the same lease; one batch operation would bypass the cross-worker locking contract.
const batches = await Promise.all([worker.claim(), otherWorker.claim()]);
```

`db21-promises/require-local-reason` requires `eslint-disable-next-line` or
`eslint-disable-line`, followed by `--` and at least 20 explanation characters.
Targeted file-wide exceptions and inline severity downgrades are rejected. The
shared processor also rejects disabling or downgrading the reason validator.
Reviewers assess whether the explanation is valid; lint checks its presence and
length, not semantic necessity. No automatic fix changes concurrency semantics.

## Scope and limits

- Only directly awaited calls to the global `Promise.all` are checked. Returned
  calls, stored promises, aliases, dynamic member names and custom wrappers are
  not traced. Do not use these detection limits to evade the policy.
- Locally shadowed or imported `Promise` bindings are not treated as the global API.
- `Promise.allSettled`, `Promise.race` and other combinators remain unchanged;
  they are not recommended substitutes for escaping this rule.
- Configuration overrides and custom processors remain trusted configuration.
  A replacement processor must preserve the shared validator protections and size
  guidance. This is an architectural review policy, not a security boundary.

This ships in toolkit presets only. Existing consumers inherit it after updating
their toolkit dependency; no consumer queries or configuration are rewritten.
