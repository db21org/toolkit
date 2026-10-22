# Raw SQL justification policy

Shared ESLint profiles enable `db21-sql/require-justification` and
`db21-sql/require-local-reason` as errors for JavaScript and TypeScript. Prefer
ordinary ORM queries, then typed query-builder APIs. Retain raw SQL when those
cannot preserve required behavior, atomicity, or a verified query plan.

```ts
// eslint-disable-next-line db21-sql/require-justification -- Transaction-scoped advisory lock has no equivalent ORM or builder operation; serializes reconciliation runs.
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
```

Each recognized execution or fragment needs its own local exception. Use
`eslint-disable-next-line` or `eslint-disable-line` with `--` followed by at least
20 characters explaining why the ORM or builder is insufficient. A label such as
"performance" is not enough; name the required behavior or measured constraint.
File-wide exceptions and inline configurations lowering the justification rule
to `warn` or `off` are rejected. No automatic fixes or query rewrites are provided.

## Detection

- Calls and tagged templates for `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`,
  and `$executeRawUnsafe`, including static computed properties and optional
  chains. These distinctive method names are matched structurally, not through
  TypeScript receiver types.
- `Prisma.sql` and `Prisma.raw`, including ESM aliases of a named `Prisma` import,
  workspace re-exports, and namespace imports exposing `Prisma`.
- ESM imports of Kysely's `sql` tag, including aliases and namespace imports;
  `sql.raw`, `sql.lit`, `sql.ref`, and `sql.id` also require review because they
  introduce raw text, inline literals, or unchecked identifiers.

Ordinary builder chains and composition helpers such as `Prisma.join`,
`sql.join`, and `sql.val` are not violations. An execution using `Prisma.sql`
contains two review points: execution and fragment. A single local comment may
cover both when they start on the same line; split lines need local reasons at
each reported location. Bindings shadowed by local variables are not confused
with imported SQL helpers.

Detection does not infer CommonJS bindings, extracted method aliases, custom
wrappers, dynamically computed method names, or re-exported Kysely helper aliases
from other packages. Direct driver APIs such as `pg.query` are outside this rule;
keep execution centralized and review new database entry points. This is a
review policy, not SQL validation or an injection-security boundary. Repository
configuration can override ESLint rules; review configuration and blanket
all-rule disables as well.

## Adoption

No Prisma or Kysely dependency is needed to use the rule. It neither installs a
query builder nor changes database schemas, migration ownership, or runtime
execution. Consumers inherit the policy after updating toolkit. Review existing
SQL manually; do not replace locking, conditional upserts, vector ranking, or
atomic claims merely to satisfy lint. Justification never makes interpolation
of untrusted SQL text safe: keep values parameterized and validate dynamic
identifiers against an explicit allowlist.
