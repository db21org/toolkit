# Publishing @db21/toolkit

The GitHub repository `db21org/toolkit` and npm package are intended to be public.
The npm package uses the separate `@db21` scope. All published toolkit contents
are reusable under MIT. Original TypeScript, tests and source maps are excluded
from the npm package to keep it lean; sources and tests live in GitHub.

## One-time manual bootstrap

Do not enable automated publication until the stable package exists and the
trusted publisher is configured. These commands publish publicly and are intended
for a maintainer to run deliberately; setup work does not run them automatically.

1. Review all files and any Git history for secrets, internal details and
   redistribution rights before publishing source. Create the public GitHub
   repository and push the reviewed code, including `.github/workflows/publish.yml`.
   Confirm access to the npm `db21` organization. Public toolkit actions can then
   be referenced directly with `uses: db21org/toolkit/actions/setup-yarn@<commit-sha>`
   or `uses: db21org/toolkit/actions/prepare-turbo-workspace@<commit-sha>` without
   credentials or private-action access settings. Pin full commit SHAs.
2. Use Node.js 22.16+ and the pinned Yarn version. Run all checks:

   ```sh
   corepack enable
   corepack yarn install --immutable
   corepack yarn check
   corepack yarn lint
   corepack yarn test
   corepack yarn format:check
   corepack yarn test:pack
   npm pack --dry-run
   ```

3. Check that `package.json` still has version `1.0.0`. Authenticate interactively
   with the correct npm account, then publish the stable package:

   ```sh
   npm login
   npm publish --access public --tag latest
   ```

   Complete npm's interactive 2FA prompts. `prepack` rebuilds the package before
   publication. `publishConfig` fixes the public registry. Local manual bootstrap
   does not generate CI provenance; later OIDC publications from the public GitHub
   repository automatically include npm provenance attestations.

4. In npm's `@db21/toolkit` package settings, add a GitHub Actions trusted publisher:
   - Organization: `db21org`
   - Repository: `toolkit`
   - Workflow filename: `publish.yml` (not the full path)
   - Environment: leave empty; this workflow does not use one
   - Allowed actions: explicitly allow **npm publish**, not only staged publishing
5. Push to `main`, or run **📦 Validate and publish npm package** manually on `main`. A new npm
   trusted-publisher configuration needs its first successful publish within two
   days or it expires. Every passing current-main run is eligible to publish;
   no repository variable is required.
6. Confirm `latest` still points to `1.0.0` and `dev` points to the preview. Once
   OIDC works, npm recommends **Require two-factor authentication and disallow
   tokens**. No npm token secret is needed by this workflow.

## Automated previews

GitHub-hosted Ubuntu runners use Node.js 24 with npm supporting trusted publishing
(npm 11.5.1+). Pull requests validate only and never receive publication permissions.
The publish job has `id-token: write` and only runs in `db21org/toolkit` on `main`
after all checks pass. No release dependency cache is restored.

The version generator reads the public npm `latest` version, increments its patch,
and appends the run number, retry attempt and short commit SHA:

```text
latest: 1.0.0
dev:    1.0.1-dev.42.1.gabcdef123456
retry:  1.0.1-dev.42.2.gabcdef123456
```

Registry lookup failures stop publication. The version changes only in the CI
checkout; it is not committed and does not change the lockfile. Publishing always
uses `--tag dev`, so previews never replace `latest`.

Publish jobs are serialized without canceling an active publication. Immediately
before publishing, the job checks GitHub's current `main` SHA and skips superseded
checkouts. This avoids a delayed old run moving `dev` backward. Intermediate pushes
may be skipped, including pending jobs replaced by GitHub's concurrency queue. If
the newest commit fails validation, `dev` stays on its previous passing version.
Disable the workflow in GitHub Actions to pause future publication runs.

## Stable releases

In GitHub Actions, run **📦 Validate and publish npm package** on `main` with
**channel: stable**. The default channel remains `dev`; pushes still publish only
dev previews. This uses the existing `publish.yml` trusted publisher.

After validation, the stable job resolves npm `dev` once, downloads that exact
version with npm, strips its prerelease suffix, and publishes the built artifact
under `latest`. Only `package.json` version changes; no rebuild or package
lifecycle scripts run. For example, `1.0.1-dev.42.1.gabcdef123456` becomes `1.0.1`.
Dev and stable publication share a concurrency group. Registry errors, malformed
versions, unsafe archives, or versions not newer than `latest` stop the release.
npm rejects already-published versions. The `dev` tag is unchanged.

No version commit, Git tag, or GitHub release is created. After stable `1.0.1`,
the next passing main preview uses `1.0.2-dev...`. This flow releases the preview's
existing base version; minor/major stable versions still require a deliberate
manual release when SemVer requires one.

The workflow has not been tested against live npm publishing during local setup.
OIDC authentication can only be verified after the repository and npm publisher
are configured; `npm whoami` is not a trusted-publishing check.

Reference: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).
