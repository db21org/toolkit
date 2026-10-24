# Prisma repository boundary

Shared toolkit ESLint presets enable `db21-prisma/repository-only` as an error.
Prisma runtime access belongs in `*.repository.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`.
Services call repositories instead of constructing, injecting or querying clients.
Tests, scripts and database infrastructure do not receive automatic exceptions.

The rule detects:

- Named runtime imports/reexports of `Prisma`, `PrismaClient`, `PrismaService`
  and `createPrismaClient`, including import aliases and workspace barrels.
- Namespace/default imports, wildcard exports, literal dynamic imports and
  unshadowed `require` calls for `@prisma/client` and `@prisma/client/extension`.
- Reserved Prisma APIs, including transactions, lifecycle, extensions and raw
  execution, through member access or destructuring. Static computed names and
  optional chaining are included.
- With TypeScript parser services: runtime references to Prisma-shaped clients
  and transactions, constructors, and generated model delegates. This includes
  type-only injection, renamed variables, class properties and detached delegates.

Type-only imports/exports and ordinary runtime enum imports remain allowed.
Erased `typeof` type queries, including `InstanceType<typeof PrismaClient>`, remain allowed.
Access through a type-only imported client is still runtime access and is rejected.
Raw SQL inside a repository still needs its separate SQL-policy justification.

## Database infrastructure exceptions

Allow only the specific files that own client creation, lifecycle, shared database
adapters or integration setup. Keep application services outside these exceptions.

```js
import config from "@db21/toolkit/eslint";

export default [
  ...config,
  {
    files: [
      "packages/database/src/create-prisma-client.ts",
      "apps/api/src/modules/database/services/prisma.service.ts",
    ],
    rules: { "db21-prisma/repository-only": ["error", { allow: true }] },
  },
];
```

`clientNames: ["DatabaseService"]` adds project-specific named client imports and
reexports to the defaults. Use it when a client wrapper has a different public name.
The rule never rewrites queries or moves transaction ownership automatically.

## Limits

This is an architecture check, not a security boundary. Client recognition uses
reserved names/APIs and available TypeScript information; an unrelated API using
the same reserved names can also report. Without type information, arbitrary
injected clients, renamed delegates and custom wrappers cannot all be inferred.
`any`, computed module/method names, other SQL libraries and cross-file wrapper
semantics remain outside complete detection. Namespace access through custom
barrels needs type information. ESLint overrides and repository naming remain
trusted configuration; use architectural import checks alongside this rule.

No Prisma runtime import is needed to load the plugin.
