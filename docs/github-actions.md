# GitHub Actions

Pin every action to a reviewed full commit SHA. These composite actions target
GitHub-hosted Ubuntu runners; shell steps require Bash, Node.js 22.16+, and, for
deployment submission, jq and Make. They introduce no npm installation requirement.
Check out the consumer repository before building images or submitting deployments.

## Setup

- `setup-yarn`: install Node.js (default 22), enable Corepack, restore Yarn cache.
- `prepare-turbo-workspace`: run configured tasks for `workspace` in `directory`,
  or build dependencies only with `run-tasks: "false"`.

## Build selection

`select-image-builds` consumes JSON arrays `components`, `workspace-components`,
and `changes` (path-filter keys), plus `workspace-graph-changed` and manual
`component` selection. It supports `push` and `workflow_dispatch` events and
returns a JSON `components` array suitable for `fromJSON` in a matrix.

For a workspace graph change, it selects the workspace components plus any directly
changed components. Non-Node components can therefore remain outside workspace-only
rebuilds. Manual `all` selects every supported component. Path filters, component
allowlists, and build/deployment policies remain consumer-owned.

## GHCR publication

`publish-image` requires `tags` and `registry-password` (normally `github.token`),
and job permissions `contents: read` and `packages: write`. It logs into GHCR,
configures Buildx, and publishes with provenance and SBOM enabled. The `digest`
output is the immutable published image digest.

Optional inputs: `context`, `file`, `platforms`, `qemu`, `build-args`, `cache-from`,
and `cache-to`. Set `qemu: "true"` for emulated multi-platform builds. Build arguments
must never contain secrets. This action does not run application validation,
generate configuration, or deploy anything.

## Publication receipts

`record-image-release` validates `component`, `digest`, and `source-sha` (default
`github.sha`). It uploads a 30-day artifact named
`image-release-COMPONENT-attempt-RUN_ATTEMPT`, containing:

```json
{
  "component": "api",
  "image": "sha256:<64 lowercase hexadecimal characters>",
  "sha": "<40 lowercase hexadecimal characters>"
}
```

`collect-image-releases` takes `run-id`, `run-attempt`, `source-sha`, a JSON
`components` allowlist, and `github-token` with `actions: read` permission. It
downloads only the selected attempt and returns an `images` JSON array. No receipts
produces `[]`; malformed records, extra fields, unknown components, source mismatch,
symlinks, and duplicate components fail closed. Artifacts stay in separate
directories, preventing identical receipt filenames from silently overwriting.

The consumer must constrain `workflow_run` to its own repository and permitted
source events/branches. Choose explicitly whether partial matrix success is
deployable; the receipt action does not choose that policy. Keep its upstream
workflow display name synchronized with the `workflow_run.workflows` reference.

## Deployment submission

`submit-deployment` executes `make deploy-COMPONENT` in `directory` (default `.`).
Required inputs: `component`, `image`, `sequence`, `attempt`, `request-id`,
`access-client-id`, and `access-client-secret`. `channel` defaults to `main`.
Pass Access credentials from GitHub secrets, never literal values.

The consumer Makefile owns endpoints, application manifests, namespaces, request
semantics, and rollout policy. Its target must consume these environment variables:

- `IMAGE`: immutable `sha256` digest.
- `REQUEST_ID`: stable idempotency key, reused for retries.
- `DEPLOY_CURL_CONFIG`: private curl config containing Access headers and ordering
  fields `channel`, `sequence`, and `attempt`. Pass it to curl using `--config`.

Use the publication workflow's run number/attempt for ordering, not the deployment
workflow's counters. The action validates identifiers, rejects credential newlines,
writes credentials only into a mode-0600 temporary config, and removes that config
on success or failure. Do not print that file or enable shell tracing. Submission
success is not rollout confirmation. The action does not enable retries, broaden
deployment scope, or apply infrastructure directly.
