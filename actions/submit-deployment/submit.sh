#!/usr/bin/env bash
set -euo pipefail

[[ "$COMPONENT" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || { printf 'Invalid component\n' >&2; exit 1; }
DEPLOY_MODE=${DEPLOY_MODE:-image}
if [[ "$DEPLOY_MODE" == image ]]; then
  [[ "$IMAGE" =~ ^sha256:[0-9a-f]{64}$ ]] || { printf 'Invalid image digest\n' >&2; exit 1; }
elif [[ "$DEPLOY_MODE" == configuration ]]; then
  [[ -z "${IMAGE:-}" ]] || { printf 'Configuration must not include an image\n' >&2; exit 1; }
  [[ "${APPLY_TIMEOUT:-}" =~ ^[1-9][0-9]{0,3}$ ]] && (( APPLY_TIMEOUT <= 3600 )) || { printf 'Invalid apply timeout (1-3600 seconds)\n' >&2; exit 1; }
else
  printf 'Invalid deployment mode\n' >&2; exit 1
fi
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
if [[ "$DEPLOY_MODE" == image ]]; then
  make --directory="$DEPLOY_DIRECTORY" "deploy-$COMPONENT"
  printf 'Requested `%s` at `%s`. Accepted or Superseded does not confirm rollout success.\n' "$COMPONENT" "$IMAGE" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi

printf 'form-string = "mode=configuration"\n' >> "$DEPLOY_CURL_CONFIG"
response=$(make --silent --directory="$DEPLOY_DIRECTORY" "deploy-$COMPONENT")
phase=$(jq -er '.phase // "Accepted"' <<< "$response")
if [[ "$phase" == Superseded ]]; then
  printf 'Configuration `%s`: Superseded by a newer accepted request.\n' "$COMPONENT" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
DEPLOYMENT_ID=$(jq -er '.id | select(type == "string" and test("^release-[a-f0-9]{40}$"))' <<< "$response")
export DEPLOYMENT_ID
# Status is a GET: do not carry multipart ordering fields into polling requests.
jq -nr '
  "header = " + ("CF-Access-Client-Id: " + env.CF_ACCESS_CLIENT_ID | @json),
  "header = " + ("CF-Access-Client-Secret: " + env.CF_ACCESS_CLIENT_SECRET | @json)
' > "$DEPLOY_CURL_CONFIG"
deadline=$((SECONDS + APPLY_TIMEOUT))
while (( SECONDS < deadline )); do
  # A receipt can briefly return 404 before the durable worker materializes it.
  if response=$(make --silent --directory="$DEPLOY_DIRECTORY" "configuration-status-$COMPONENT"); then
    phase=$(jq -er '.configurationPhase // .phase' <<< "$response")
    case "$phase" in
      Applied)
        readiness=$(jq -er '.capabilityReadiness' <<< "$response")
        printf 'Configuration `%s`: Applied. Capability readiness: `%s` (not a CI gate).\n' "$COMPONENT" "$readiness" >> "$GITHUB_STEP_SUMMARY"
        exit 0 ;;
      Failed|Error|Rejected)
        printf 'Configuration apply failed: %s (%s)\n' "$phase" "$DEPLOYMENT_ID" >&2
        exit 1 ;;
      Accepted|Pending|Running|Succeeded) ;;
      *) printf 'Unexpected configuration phase: %s\n' "$phase" >&2; exit 1 ;;
    esac
  fi
  sleep 3
done
printf 'Configuration apply timed out (%s); inspect its receipt before retrying.\n' "$DEPLOYMENT_ID" >&2
exit 1
