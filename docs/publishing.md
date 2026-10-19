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
5. Set the GitHub repository Actions variable `NPM_PUBLISH_ENABLED` to `true`.
   Push to `main`, or run **Validate and publish** manually on `main`. A new npm
   trusted-publisher configuration needs its first successful publish within two
   days or it expires. Validation runs without this variable; publication does not.
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
Disable the repository variable to pause future publication jobs.

## Later stable releases

Stable releases remain manual. Update `package.json` to the intended stable SemVer
version, run the checks, review the tarball and publish with `--tag latest` using
interactive authentication. An already published version cannot be reused.
After stable `1.0.1`, main previews automatically use `1.0.2-dev...`.
Use a minor or major stable release when required by SemVer; the preview patch
number does not promise that unreviewed main changes are backward-compatible.

The workflow has not been tested against live npm publishing during local setup.
OIDC authentication can only be verified after the repository and npm publisher
are configured; `npm whoami` is not a trusted-publishing check.

Reference: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).
