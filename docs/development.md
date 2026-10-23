# Development

`yarn test:outbox` runs isolated Docker PostgreSQL outbox contracts, generates a
Prisma client and migrations, and checks consumer types. It never uses application
database URLs. Docker is required; see [Prisma outbox](prisma-outbox.md).

Shared ESLint base rules cover `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and
`.cts`: braces, statement spacing, import sorting, size limits, and applicable
JSDoc rules stay consistent. Type-aware checks and TypeScript-only conventions
remain scoped to TypeScript; JavaScript can use native `#private` fields. Framework
presets add their own scoped rules. Generated files and explicit profile overrides
retain their existing exceptions.

Static imports must precede other statements; comments, shebangs, and directive
prologues such as `"use client"` may come first. Dynamic imports are unaffected.

Requires Node.js 22.16+ and Yarn 4.16, as declared in `package.json`.
Run these commands from the repository root:

```sh
corepack yarn install --immutable
corepack yarn check
corepack yarn lint
corepack yarn test
corepack yarn format:check
corepack yarn test:pack
corepack yarn test:bootstrap
```

Keep changes focused, document public API changes, and run the relevant checks
before submitting a pull request. Do not include credentials, private project
details, or unrelated changes.

Shared ESLint presets enforce [per-test justification](test-policy.md). Existing
tests must be reviewed individually before their policy errors are resolved;
do not add blanket exceptions or delete tests solely to make lint pass.

## Build and package validation

`build` uses tsup to bundle ESM and declarations plus CommonJS utilities/money.
A build hook copies authored `.mjs`/`.d.mts` configurations. Tests cover runtime
behavior, type fixtures, conventions, and base ESLint rules.

`test:pack` creates a tarball, installs it in an isolated temporary consumer with
the required hosts, and checks every public entry, CommonJS, declarations, React
augmentation, and included actions. It may access the dependency registry but
does not publish.

`test:bootstrap` generates all four app types in an isolated temporary workspace,
installs the packed toolkit artifact, and runs formatting, lint, type,
architecture, test, and build checks plus an API health request. It accesses the
dependency registry and disables dependency lifecycle scripts. Expo JavaScript
bundles are exported for web, iOS, and Android; native toolchains and devices are
not exercised. Unit tests cover all 15 nonempty
app selections and destination safety; `test:pack` checks the installed CLI and
bundled templates without requiring integration peers.

The npm artifact includes compiled JavaScript, declarations, configurations,
actions, documentation, and bundled bootstrap templates. Original toolkit
TypeScript, tests, and source maps are excluded; sources and tests belong in the
GitHub repository. Templates intentionally include starter source and test files.

## Known dependency warnings

The upstream Inversify disposal stack currently reports incomplete
`reflect-metadata` peer propagation. The toolkit explicitly depends on
`reflect-metadata`; runtime and artifact tests validate the integrated stack.

Runtime-only installs can produce Yarn peer warnings for ESLint and TypeScript
required by lint-plugin dependencies, even though those hosts are optional at the
toolkit boundary. Utilities and money are tested without declaring integration
hosts and without React or ESLint installed. SonarJS brings TypeScript
transitively; importing a lint profile still requires its hosts.

## Releases

See [Publishing](publishing.md) for stable releases, development previews, and
trusted-publisher setup. Publishing is separate from contribution validation.
