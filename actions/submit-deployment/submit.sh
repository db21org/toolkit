#!/usr/bin/env bash
set -euo pipefail

[[ "$COMPONENT" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || { printf 'Invalid component\n' >&2; exit 1; }
[[ "$IMAGE" =~ ^sha256:[0-9a-f]{64}$ ]] || { printf 'Invalid image digest\n' >&2; exit 1; }
[[ "$DEPLOY_CHANNEL" =~ ^[a-zA-Z0-9_-]{1,64}$ ]] || { printf 'Invalid deployment channel\n' >&2; exit 1; }
[[ "$DEPLOY_SEQUENCE" =~ ^[1-9][0-9]*$ && "$DEPLOY_ATTEMPT" =~ ^[1-9][0-9]*$ ]] || { printf 'Invalid deployment ordering\n' >&2; exit 1; }
[[ "$REQUEST_ID" =~ ^[a-zA-Z0-9_-]{8,128}$ ]] || { printf 'Invalid request ID\n' >&2; exit 1; }
: "${CF_ACCESS_CLIENT_ID:?Configure Cloudflare Access client ID}"
: "${CF_ACCESS_CLIENT_SECRET:?Configure Cloudflare Access client secret}"
[[ "$CF_ACCESS_CLIENT_ID$CF_ACCESS_CLIENT_SECRET" != *$'\n'* && "$CF_ACCESS_CLIENT_ID$CF_ACCESS_CLIENT_SECRET" != *$'\r'* ]] || { printf 'Invalid Access credentials\n' >&2; exit 1; }

umask 077
export IMAGE REQUEST_ID DEPLOY_CURL_CONFIG
DEPLOY_CURL_CONFIG=$(mktemp "$RUNNER_TEMP/deployment-access.XXXXXX")
trap 'rm -f "$DEPLOY_CURL_CONFIG"' EXIT
jq -nr '
  "header = " + ("CF-Access-Client-Id: " + env.CF_ACCESS_CLIENT_ID | @json),
  "header = " + ("CF-Access-Client-Secret: " + env.CF_ACCESS_CLIENT_SECRET | @json),
  "form-string = " + ("channel=" + env.DEPLOY_CHANNEL | @json),
  "form-string = " + ("sequence=" + env.DEPLOY_SEQUENCE | @json),
  "form-string = " + ("attempt=" + env.DEPLOY_ATTEMPT | @json)
' > "$DEPLOY_CURL_CONFIG"
make --directory="$DEPLOY_DIRECTORY" "deploy-$COMPONENT"
printf 'Requested `%s` at `%s`. Accepted or Superseded does not confirm rollout success.\n' "$COMPONENT" "$IMAGE" >> "$GITHUB_STEP_SUMMARY"
