# @db21/toolkit

Runtime utilities, decimal-backed money primitives, modular dependency injection,
and shared TypeScript tooling. Import only the entry points your project needs.

**Release status:** the first npm release and public GitHub repository are not yet
available. Installation commands and remote links below apply after launch.

## Installation

Requires Node.js **22.16 or newer**. Use your preferred package manager:

```sh
npm install @db21/toolkit
# or
yarn add @db21/toolkit
```

For tooling-only use, install with `npm install --save-dev @db21/toolkit` or
`yarn add --dev @db21/toolkit`. Yarn is required only for contributing to this
repository, not for consuming the package.

## Quick start

```ts
import { createMoney } from "@db21/toolkit/money";
import { assert } from "@db21/toolkit/utils";

const price = createMoney("19.99", "USD");
assert.defined(price, "Invalid price");
```

Use the shared ESLint profile:

```js
// eslint.config.mjs
export { default } from "@db21/toolkit/eslint";
```

Extend a TypeScript preset:

```json
{
  "extends": "@db21/toolkit/typescript/node-next.json"
}
```

There is no root import: use `@db21/toolkit/utils`, not `@db21/toolkit`.

## Initialize agent instructions

With toolkit installed in the target repository:

```sh
yarn toolkit agents init
# Or target another existing repository:
yarn toolkit agents init ../my-project
```

Creates `AGENTS.md` or appends a marked test-assessment section, preserving existing
instructions. Repeated runs do not duplicate or replace that section. Its policy
link requires `node_modules/@db21/toolkit/docs/test-policy.md` in the target repo.
No dependency installation or ESLint configuration changes are performed.
Concurrent initializers serialize through `AGENTS.md.toolkit.lock`; an already
marked read-only file needs no write access. A crashed initializer may leave a
lock: verify no initializer is running before removing that file and retrying.
See [test policy and examples](docs/test-policy.md).

## Bootstrap a workspace

The `toolkit` executable includes an interactive `bootstrap` helper:

```sh
yarn dlx @db21/toolkit bootstrap
# Non-interactive:
yarn dlx @db21/toolkit bootstrap ./my-project --apps api,expo,astro-static,astro-ssr
```

App types: `api` (NestJS), `expo` (web/iOS/Android), `astro-static` (`apps/landing`),
and `astro-ssr` (`apps/site`). Expo lives in `apps/app`. Select any nonempty subset.
Use `--name my-project` to override the name inferred from the destination.
Names must be lowercase kebab-case, starting with a letter.

Bundled Amatok-derived starters include Yarn/Turbo, strict TypeScript, toolkit
lint and architecture checks, Prettier, editor settings, and validation-only
GitHub CI. Only selected apps and their dependencies are generated; no business
integrations or deployment setup. Templates do not fetch Amatok at runtime.

Destination must be new or empty; its parent must already exist. Files and symlink
destinations are rejected. Existing files are never overwritten, including files
created concurrently during publication. If publication fails midway, generated
files remain for inspection. Bootstrap never installs dependencies or changes Git.

After generation, run `corepack yarn install` and `corepack yarn format` in the
workspace. Review and commit `yarn.lock` before CI (which installs immutably).
See the generated README for app development commands and validation.

## Explore an RDF knowledge graph

Start a local, read-only SVG explorer against a SPARQL query endpoint:

```sh
toolkit graph http://localhost:17878/query
# Optional: restrict every query to one named graph, or choose a local port.
toolkit graph http://localhost:17878/query --graph urn:example:graph --port 4319
# From this checkout, after building:
node dist/cli/index.js graph http://localhost:17878/query
```

Open the printed `http://127.0.0.1:4319` URL. The overview shows classes with
instances. Click a class, then an instance, then any linked IRI to explore incoming
and outgoing neighborhoods recursively. Back/forward navigation, direct node IRI
entry, pagination, zoom and SVG download are included. Hover cards and edges for
full identifiers, predicates and literal previews. Downloaded SVGs are static
snapshots; interactive navigation lives in the server UI.

No Novyn vocabulary, external graph libraries or browser CDN is required. Queries
include default and named graphs unless `--graph` is supplied; historical revisions
may therefore appear together. The view shows stored RDF connections, not verified
facts, resolved identities or inferred subject/actor relationships.

The server binds only to `127.0.0.1`, fixes its upstream at startup and exposes no
query editor or write proxy. Only generated SELECT queries run. Requests time out
after 15 seconds, responses are bounded to 2 MB, pages contain at most 24 results,
and literal previews stop at 1,800 characters. Blank nodes are visible in
neighborhoods but not independently expandable; class instance lists include IRIs
only. Large-store class counts can still be expensive. Authenticated endpoints,
RDF file loading and public/multi-user hosting are not supported. Use a trusted
endpoint, keep this local, and stop with Ctrl+C.

## Integration requirements

Install the optional peer dependencies used by your integration:

- **Utilities, money, or Feature Kit core:** no integration peers required.
- **Domain events:** Zod `^4.4.3`.
- **Prisma outbox runtime:** `@prisma/client >=7.8 <8` and PostgreSQL; the schema
  configuration helper needs no Prisma runtime peer.
- **Feature Kit React:** React 19; TypeScript projects also need `@types/react`.
- **ESLint profiles:** ESLint `>=10.4 <11` and TypeScript `>=5 <7`.
- **Dependency-cruiser conventions:** dependency-cruiser 18.
- **GraphQL validation helpers:** GraphQL 16, in addition to the linting hosts.

For example:

```sh
npm install react@19
npm install --save-dev 'eslint@>=10.4 <11' 'typescript@>=5 <7'
```

Feature Kit requires TypeScript's `experimentalDecorators: true`. Its React entry
registers module metadata as a side effect; do not mark the entire package as
side-effect-free in your bundler configuration.

## Entry points and compatibility

Utilities, money, events, and Prisma outbox entries support ESM and CommonJS. Feature Kit and JavaScript tooling
entries are ESM-only. Type declarations are included.

| Subpath                                                                                 | Purpose                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `@db21/toolkit/utils`                                                                   | Assertions, predicates, `Maybe`, and waiting helpers         |
| `@db21/toolkit/money`                                                                   | Decimal-backed money primitives                              |
| `@db21/toolkit/events`                                                                  | Versioned event schemas, definitions, and typed registries   |
| `@db21/toolkit/prisma/outbox`                                                           | Transactional outbox model extension                         |
| `@db21/toolkit/prisma/outbox/config`                                                    | Canonical outbox schema composition for Prisma configuration |
| `@db21/toolkit/feature-kit`                                                             | Modular dependency injection and application lifecycle       |
| `@db21/toolkit/feature-kit/react`                                                       | React providers and Surfaces                                 |
| `@db21/toolkit/feature-kit/conventions/{core,react,nestjs}/{eslint,dependency-cruiser}` | Static module conventions                                    |
| `@db21/toolkit/eslint/base`                                                             | Project-agnostic `recommended` and opt-in `react` rules      |
| `@db21/toolkit/eslint`                                                                  | Shared TypeScript/JavaScript conventions                     |
| `@db21/toolkit/eslint/{react,astro}`                                                    | Framework-specific flat-config arrays                        |
| `@db21/toolkit/eslint/{expo,nest}`                                                      | `createExpoConfig({ cwd })` and `createNestConfig({ cwd })`  |
| `@db21/toolkit/eslint/plugins`                                                          | Individual custom rule plugins                               |
| `@db21/toolkit/eslint/expo/graphql-conventions`                                         | Feature-private GraphQL validation helpers                   |
| `@db21/toolkit/typescript/{base,browser,bundler,node-next,node16,vitest}.json`          | TypeScript presets                                           |

Subpaths isolate loading, not installation size or releases. Every entry shares
one package version and dependency installation. Arbitrary deep imports are not
supported.

The framework lint profiles are opinionated, opt-in presets, not universal
framework requirements. The Expo profile defaults to `src/features` and
`src/modules`, feature-private generated GraphQL files, i18n, NativeWind, and a
navigation hook. Customize source/module roots, roles, folders, and GraphQL layout
through the factory options. Override the default
`useAppRouter` from `@/components/navigation` with
`navigationHook: { file, importSource, name }`. The default hook file is
`src/components/navigation/use-app-router.hook.ts`. Use lower-level convention
factories when you do not want the entire shared profile. See
[lint profiles](docs/lint-profiles.md) for configuration examples.

## Documentation

- [Utilities](docs/utils.md)
- [Money policies and conversion behavior](docs/money.md)
- [Domain events](docs/events.md)
- [Prisma PostgreSQL outbox](docs/prisma-outbox.md)
- [Lint profiles and configurable layouts](docs/lint-profiles.md)
- [Raw SQL justification policy](docs/raw-sql-policy.md)
- [Native batching and Promise.all exceptions](docs/promise-all-policy.md)
- [Prisma repository boundary](docs/prisma-repository-policy.md)
- [Exported type alias policy](docs/type-alias-policy.md)
- [Test value assessment and agent instructions](docs/test-policy.md)
- [Feature Kit React](docs/feature-kit-react.md)
- [Module conventions](docs/feature-kit-conventions.md)
- [Base ESLint rules](docs/eslint-base-rules.md)

## GitHub Actions

Composite actions cover Yarn/Turbo setup, GHCR publication, image-release receipts,
build selection, and deployment submission. Reference them directly and replace
`<full-commit-sha>` with a real, pinned commit:

```yaml
- uses: db21org/toolkit/actions/setup-yarn@<full-commit-sha>
- uses: db21org/toolkit/actions/prepare-turbo-workspace@<full-commit-sha>
  with:
    workspace: your-workspace-name
```

Setup Yarn expects a Yarn project at the checkout root. The Turbo action accepts
`directory`, `workspace`, `tasks`, and `run-tasks`. Public actions require no
private-repository access credentials. See the [actions guide](docs/github-actions.md)
for publication permissions, receipt validation, and deployment contracts.

## Contributing and support

See the [development guide](docs/development.md) for setup, validation, and known
dependency warnings. Include a minimal reproduction, package version, Node.js
version, and affected entry point when reporting a bug.

After launch, report bugs through [GitHub Issues](https://github.com/db21org/toolkit/issues).
Release maintainers should use the separate [publishing guide](docs/publishing.md).

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for attribution.
