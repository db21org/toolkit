# Logical expression readability

Base and shared JS/TS presets enable `db21-logic/max-checks` as an error.
Each connected logical expression permits at most **three operands** (checks),
not three operators. Parentheses, mixed `&&`/`||`/`??`, negation, and TypeScript
assertions do not reset the count. Nested groups produce one report for the
outer expression, not repeated reports for each subgroup.

The limit applies everywhere: conditions, ternary tests and branches, returns,
assignments, arguments, JSX, and loops. Independent expressions in different
arguments, ternary branches, or function bodies are assessed separately. This is
syntactic readability enforcement, not interprocedural complexity analysis.

```ts
// Rejected: four checks, even with grouping.
if (enabled && authenticated && (owner || administrator)) {
  publish();
}

// Prefer focused guards where control flow permits.
if (!enabled || !authenticated) {
  return;
}
if (!owner && !administrator) {
  return;
}
publish();
```

Use meaningful domain predicates when they clarify intent, not trivial wrappers
that hide the same chain. Preserve evaluation order, short-circuit effects and
returned values: `&&`, `||`, and `??` do not necessarily return booleans. Early
returns are guidance, not an automatic rewrite; no autofix changes behavior.
