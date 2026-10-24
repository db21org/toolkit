# Export original types

`db21-type-aliases/no-redundant-alias` is an error in shared TypeScript presets.
Do not introduce a new exported name for an otherwise unchanged type:

```ts
// Rejected: an additional name, not an additional contract.
export type GenerationResult = ArticleGeneration;

// Prefer the original type.
export type { ArticleGeneration } from "./article-generation";
```

Plain identifier and qualified-name aliases are rejected, including local aliases
exported later with `export { … }` or `export type { … }`. Local, unexported aliases
remain allowed.

Unions, intersections, object types, primitive aliases and generic specialization
such as `Pick<ArticleGeneration, "id">` or `Promise<ArticleGeneration>` are not
identity aliases. Generic declarations are outside this narrow check; no structural
type equivalence is inferred. Direct type reexports, including renamed export
specifiers, are not changed by this rule. It has no autofix because replacing a
public name requires reviewing downstream callers.
