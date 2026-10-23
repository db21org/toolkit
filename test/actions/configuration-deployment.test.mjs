import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const actions = fileURLToPath(new URL("../../actions/", import.meta.url));
const digest = `sha256:${"b".repeat(64)}`;
let directory;
let env;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "toolkit-actions-"));
  env = {
    PATH: process.env.PATH,
    RUNNER_TEMP: directory,
    GITHUB_OUTPUT: join(directory, "output"),
    GITHUB_STEP_SUMMARY: join(directory, "summary"),
  };
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

beforeEach(() => {
  writeFileSync(join(directory, "make"), "#!/bin/bash\nexit 1\n", {
    mode: 0o700,
  });
});

const submit = (overrides = {}) =>
  spawnSync("bash", [join(actions, "submit-deployment/submit.sh")], {
    env: {
      ...env,
      PATH: `${directory}:${process.env.PATH}`,
      COMPONENT: "api",
      IMAGE: digest,
      DEPLOY_CHANNEL: "main",
      DEPLOY_SEQUENCE: "42",
      DEPLOY_ATTEMPT: "2",
      REQUEST_ID: "gha-123-2-api",
      DEPLOY_DIRECTORY: directory,
      CF_ACCESS_CLIENT_ID: "example-client",
      CF_ACCESS_CLIENT_SECRET: 'example-"secret',
      ...overrides,
    },
    encoding: "utf8",
  });

const configure = (overrides = {}) =>
  submit({
    DEPLOY_MODE: "configuration",
    IMAGE: "",
    APPLY_TIMEOUT: "10",
    ...overrides,
  });

const configurationMake = () =>
  writeFileSync(
    join(directory, "make"),
    `#!/bin/bash
set -eu
printf '%s\n' "\${!#}" >> "$RUNNER_TEMP/calls"
case "\${!#}" in
  deploy-api)
    cp "$DEPLOY_CURL_CONFIG" "$RUNNER_TEMP/captured"
    test -z "$IMAGE"
    if [[ "\${FAKE_SUBMIT:-}" == Superseded ]]; then
      printf '{"phase":"Superseded"}'
    else
      printf '{"id":"release-${"a".repeat(40)}"}'
    fi ;;
  configuration-status-api)
    cp "$DEPLOY_CURL_CONFIG" "$RUNNER_TEMP/status-config"
    test "$DEPLOYMENT_ID" = "release-${"a".repeat(40)}"
    if [[ "\${FAKE_INITIAL_404:-}" == true && ! -f "$RUNNER_TEMP/retried" ]]; then
      touch "$RUNNER_TEMP/retried"
      exit 22
    fi
    printf '{"configurationPhase":"%s","capabilityReadiness":"Pending"}' "\${FAKE_PHASE:-Applied}" ;;
  *) exit 1 ;;
esac
`,
    { mode: 0o700 },
  );

describe("configuration deployment", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: configuration apply can expose credentials or wait forever on external readiness; Contract: apply succeeds without an image, polls without multipart fields, reports readiness and cleans private auth.
  it("applies configuration without an image or readiness gate", () => {
    configurationMake();
    const result = configure();

    expect(result.status).toBe(0);
    expect(readFileSync(join(directory, "calls"), "utf8")).toBe(
      "deploy-api\nconfiguration-status-api\n",
    );
    expect(readFileSync(join(directory, "captured"), "utf8")).toContain(
      'form-string = "mode=configuration"',
    );
    expect(
      readFileSync(join(directory, "status-config"), "utf8"),
    ).not.toContain("form-string");
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toContain(
      "Applied. Capability readiness: `Pending`",
    );
    expect(result.stdout + result.stderr).not.toContain('example-"secret');
    expect(
      readdirSync(directory).some((name) =>
        name.startsWith("deployment-access."),
      ),
    ).toBe(false);
    expect(statSync(join(directory, "captured")).mode & 0o777).toBe(0o600);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: superseded configuration could poll a nonexistent release and claim success; Contract: superseded admission exits successfully after submission without status polling.
  it("stops after superseded admission without polling", () => {
    configurationMake();
    expect(configure({ FAKE_SUBMIT: "Superseded" }).status).toBe(0);
    expect(readFileSync(join(directory, "calls"), "utf8")).toBe("deploy-api\n");
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toContain(
      "Superseded",
    );
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: terminal apply failures could be reported as successful asynchronous provisioning; Contract: Failed, Error and Rejected phases return a failing process and clean auth.
  it.each(["Failed", "Error", "Rejected"])(
    "fails CI on configuration apply %s",
    (phase) => {
      configurationMake();
      expect(configure({ FAKE_PHASE: phase }).status).toBe(1);
      expect(
        readdirSync(directory).some((name) =>
          name.startsWith("deployment-access."),
        ),
      ).toBe(false);
    },
  );
  // eslint-disable-next-line db21-tests/require-justification -- Risk: asynchronous receipt materialization could turn an accepted apply into a false failure; Contract: an initial 404 is retried and the configuration eventually succeeds.
  it("retries the short receipt materialization window", () => {
    configurationMake();
    expect(configure({ FAKE_INITIAL_404: "true" }).status).toBe(0);
    expect(
      readFileSync(join(directory, "calls"), "utf8").split("\n"),
    ).toHaveLength(4);
  });
});

describe("configuration deployment validation", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: a stuck apply can consume CI indefinitely and leave credentials behind; Contract: pending configuration fails within the timeout and removes private auth.
  it("times out a pending configuration apply", () => {
    configurationMake();
    const result = configure({ FAKE_PHASE: "Pending", APPLY_TIMEOUT: "1" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Configuration apply timed out");
    expect(
      readdirSync(directory).some((name) =>
        name.startsWith("deployment-access."),
      ),
    ).toBe(false);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: image-bearing or unbounded configuration requests can violate deployment semantics or hang CI; Contract: invalid image and timeout inputs fail before credentials or deployment state are created.
  it.each([
    { IMAGE: digest },
    { APPLY_TIMEOUT: "0" },
    { APPLY_TIMEOUT: "3601" },
  ])("rejects invalid configuration input %j", (overrides) => {
    expect(configure(overrides).status).not.toBe(0);
    expect(readdirSync(directory)).toEqual(["make"]);
  });
});
