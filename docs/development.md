# Development

Requires Node.js 22.16+ and Yarn 4.16, as declared in `package.json`.
Run these commands from the repository root:

```sh
corepack yarn install --immutable
corepack yarn check
corepack yarn lint
corepack yarn test
corepack yarn format:check
corepack yarn test:pack
```

Keep changes focused, document public API changes, and run the relevant checks
before submitting a pull request. Do not include credentials, private project
details, or unrelated changes.

## Build and package validation

`build` uses tsup to bundle ESM and declarations plus CommonJS utilities/money.
A build hook copies authored `.mjs`/`.d.mts` configurations. Tests cover runtime
behavior, type fixtures, conventions, and base ESLint rules.

`test:pack` creates a tarball, installs it in an isolated temporary consumer with
the required hosts, and checks every public entry, CommonJS, declarations, React
augmentation, and included actions. It may access the dependency registry but
does not publish.

The npm artifact includes compiled JavaScript, declarations, configurations,
actions, and documentation. Original TypeScript, tests, and source maps are
excluded; sources and tests belong in the GitHub repository.

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
