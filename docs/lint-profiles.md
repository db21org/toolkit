# Lint profiles and conventions

These are **opinionated, opt-in presets**, not universal framework requirements.
Importing runtime utilities does not enable lint rules.

- `@db21/toolkit/eslint/base` provides project-agnostic linting foundations with
  explicit style choices and an opt-in React configuration.
- `@db21/toolkit/eslint` and `/react` enforce toolkit predicates, assertions,
  `Maybe`, file naming, and helper extraction conventions.
- `/expo` additionally assumes translated UI text, NativeWind styling, a custom
  navigation entry point, and feature-owned GraphQL documents.
- `/nest` enforces Feature Kit module conventions and extracted utility files.

Use the lower-level Feature Kit convention factories when you need architecture
checks without the entire shared profile. See [module conventions](feature-kit-conventions.md).

## Framework layouts

Both `createExpoConfig` and `createNestConfig` accept:

- `cwd`: project root, required.
- `sourceRoot`: source directory, default `src`; controls framework file globs.
- `moduleRoots`: module collection directories, default
  `["<sourceRoot>/features", "<sourceRoot>/modules"]`.
- `additionalRoles`: extra role conventions; defaults to an empty list.

Paths are relative to `cwd`. Every module root must exist. A collection contains
independent module directories; existing Feature Kit naming and boundary rules
still apply. Source and module roots should describe the same project layout.

Expo additionally accepts `allowedFolders` to replace its module folder allowlist.
When omitted, the preset's folders plus any additional role folders are allowed.
Its `navigationHook: { file, importSource, name }` replaces the default
`useAppRouter` entry point; this convention is not required by Expo itself.

```js
import { createExpoConfig } from "@db21/toolkit/eslint/expo";

export default createExpoConfig({
  cwd: import.meta.dirname,
  sourceRoot: "lib",
  moduleRoots: ["lib/domains"],
  allowedFolders: ["components", "services", "documents"],
  navigationHook: {
    file: "lib/navigation/use-navigation.hook.ts",
    importSource: "@/navigation",
    name: "useNavigation",
  },
  graphql: {
    graphqlDirectory: "documents",
    documentExtensions: ["gql", "graphql"],
  },
});
```

## GraphQL layout and scalars

`describeGraphqlFile(appRoot, filePath, layout?)` and
`validateGraphqlFile({ appRoot, filePath, source, ...layout })` accept:

- `moduleRoots`: defaults to `["src/features", "src/modules"]`.
- `graphqlDirectory`: directory inside each owning module, default `graphql`.
- `documentExtensions`: accepted extensions without dots, default `["gql"]`;
  supported values are `gql` and `graphql`.

Documents still use `queries`, `mutations`, `subscriptions`, or `fragments`
subdirectories and matching operation suffixes. Owner and document names remain
kebab-case. `ownerRoot` identifies the module collection by its directory basename;
use distinct collection basenames when consuming `ownerKey` identifiers.

Pass these options through Expo's `graphql` object; it inherits the Expo module
roots unless explicitly overridden. `findGraphqlFiles(appRoot, { sourceRoot })`
controls the scan directory independently and discovers both supported extensions.

`collectUnmappedCustomScalars(schemaSource, scalarMappings?)` accepts a **replacement**
mapping. Omit it to use the exported preset mappings, pass `{}` for no custom
mappings, or spread the preset to extend it:

```js
import {
  collectUnmappedCustomScalars,
  FEATURE_GRAPHQL_SCALAR_MAPPINGS,
} from "@db21/toolkit/eslint/expo/graphql-conventions";

const unmapped = collectUnmappedCustomScalars(schemaSource, {
  ...FEATURE_GRAPHQL_SCALAR_MAPPINGS,
  UUID: "string",
});
```

## Utility exemptions

The `require-extracted-utilities` rule accepts `{ exemptPaths: [...] }`, interpreted
relative to ESLint's working directory. Each entry exempts that file or directory
tree, not similarly prefixed sibling paths. The default is `["packages/utils/src"]`.
Pass `[]` to remove this legacy monorepo exemption. Built-in exemptions for tests,
`main.ts`, module declarations, and `utils/*.util.ts` remain in place.

The Nest factory exposes this as `utilityExemptPaths`:

```js
import { createNestConfig } from "@db21/toolkit/eslint/nest";

export default createNestConfig({
  cwd: import.meta.dirname,
  moduleRoots: ["src/domains"],
  utilityExemptPaths: ["src/shared/utilities"],
});
```
