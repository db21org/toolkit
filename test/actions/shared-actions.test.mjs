import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const actions = fileURLToPath(new URL("../../actions/", import.meta.url));
const sha = "a".repeat(40);
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

const run = (script, overrides) =>
  spawnSync(process.execPath, [join(actions, script)], {
    env: { ...env, ...overrides },
    encoding: "utf8",
  });
const output = () => readFileSync(env.GITHUB_OUTPUT, "utf8");

describe("changed deployment selection", () => {
  const select = (before = "") => {
    mkdirSync(join(directory, "deploy"), { recursive: true });
    for (const name of ["namespace.yaml", "api.yaml", "admin.yml"]) {
      writeFileSync(join(directory, "deploy", name), "declaration");
    }
    return spawnSync(
      process.execPath,
      [join(actions, "changed-deployments/select.mjs")],
      {
        cwd: directory,
        env: { ...env, BEFORE: before, PATH: `${directory}:${env.PATH}` },
        encoding: "utf8",
      },
    );
  };

  // eslint-disable-next-line db21-tests/require-justification -- Initial/manual runs must include every application but never submit namespace setup as an independent release.
  it("selects all existing applications without a base revision", () => {
    expect(select().status).toBe(0);
    expect(output()).toBe('components=["admin","api"]\n');
  });

  // eslint-disable-next-line db21-tests/require-justification -- Push diffs must isolate changed/new files while namespace edits fan out and unrelated nested files stay excluded.
  it.each([
    ["deploy/api.yaml", '["api"]'],
    ["deploy/namespace.yaml", '["admin","api"]'],
    ["README.md", "[]"],
  ])("selects applications for %s", (file, expected) => {
    writeFileSync(
      join(directory, "git"),
      `#!/bin/bash\nprintf '%s\\0' '${file}'\n`,
      { mode: 0o700 },
    );
    expect(select(sha).status).toBe(0);
    expect(output()).toBe(`components=${expected}\n`);
  });

  // eslint-disable-next-line db21-tests/require-justification -- Missing declarations must not be interpreted as permission to delete infrastructure or silently omit ownership handoff.
  it("rejects deleted or renamed deployment declarations", () => {
    writeFileSync(
      join(directory, "git"),
      "#!/bin/bash\nprintf 'deploy/removed.yaml\\0'\n",
      { mode: 0o700 },
    );
    const result = select(sha);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicit ownership and teardown review");
  });
});

const receipt = (artifact, value) => {
  const path = join(directory, "receipts", artifact);

  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "api.json"), JSON.stringify(value));
};

const collect = (overrides = {}) => {
  mkdirSync(join(directory, "receipts"), { recursive: true });

  return run("collect-image-releases/collect.mjs", {
    RELEASE_DIRECTORY: join(directory, "receipts"),
    RELEASE_SOURCE_SHA: sha,
    RELEASE_COMPONENTS: '["api","web"]',
    ...overrides,
  });
};

describe("image release receipts", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Deployment receipts must bind immutable image digests to source commits and isolate repeated workflow attempts.
  it("records the immutable digest and source under an attempt-scoped artifact name", () => {
    const result = run("record-image-release/record.mjs", {
      RELEASE_COMPONENT: "api",
      RELEASE_DIGEST: digest,
      RELEASE_SOURCE_SHA: sha,
      GITHUB_RUN_ATTEMPT: "2",
    });

    expect(result.status).toBe(0);
    expect(output()).toContain("artifact-name=image-release-api-attempt-2\n");
    const path = output().split("path=")[1].trim();

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      component: "api",
      image: digest,
      sha,
    });
  });
  // eslint-disable-next-line db21-tests/require-justification -- Unsafe receipt identifiers or mutable image tags must be rejected before writing release artifacts.
  it.each([
    ["RELEASE_COMPONENT", "../escape"],
    ["RELEASE_DIGEST", "latest"],
    ["RELEASE_SOURCE_SHA", "abc"],
    ["GITHUB_RUN_ATTEMPT", "0"],
  ])("rejects invalid %s before writing a receipt", (key, value) => {
    const result = run("record-image-release/record.mjs", {
      RELEASE_COMPONENT: "api",
      RELEASE_DIGEST: digest,
      RELEASE_SOURCE_SHA: sha,
      GITHUB_RUN_ATTEMPT: "1",
      [key]: value,
    });

    expect(result.status).not.toBe(0);
    expect(readdirSync(directory)).toEqual([]);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Failed or partial publication with no receipts must not accidentally schedule deployments for unpublished images.
  it("returns an empty matrix when a partial publication has no receipts", () => {
    expect(collect().status).toBe(0);
    expect(output()).toBe("images=[]\n");
  });
  // eslint-disable-next-line db21-tests/require-justification -- Independently downloaded artifacts with identical filenames must retain all distinct component releases.
  it("collects valid receipts without merging artifact directories", () => {
    receipt("first", { component: "api", image: digest, sha });
    receipt("second", { component: "web", image: digest, sha });
    expect(collect().status).toBe(0);
    expect(JSON.parse(output().slice("images=".length))).toHaveLength(2);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Collection must reject forged source commits, unknown components, mutable tags, and malformed receipt envelopes.
  it.each([
    { component: "api", image: digest, sha: "c".repeat(40) },
    { component: "other", image: digest, sha },
    { component: "api", image: "latest", sha },
    { component: "api", image: digest, sha, extra: true },
    null,
  ])("rejects forged or malformed receipt %j", (value) => {
    receipt("one", value);
    expect(collect().status).not.toBe(0);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Duplicate component receipts must not choose an arbitrary image for deployment based on artifact traversal order.
  it("rejects duplicate components even with identical receipt filenames", () => {
    receipt("one", { component: "api", image: digest, sha });
    receipt("two", { component: "api", image: digest, sha });
    expect(collect().status).not.toBe(0);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Artifact receipt reads must not follow symlinks into files outside the downloaded release tree.
  it("rejects symlink receipts", () => {
    receipt("one", { component: "api", image: digest, sha });
    const path = join(directory, "receipts", "one", "api.json");

    rmSync(path);
    symlinkSync(env.GITHUB_OUTPUT, path);
    expect(collect().status).not.toBe(0);
  });
});

describe("image build planning", () => {
  const plan = (overrides = {}) =>
    run("select-image-builds/select.mjs", {
      BUILD_COMPONENTS: '["api","web","pipelines"]',
      BUILD_WORKSPACE_COMPONENTS: '["api","web"]',
      BUILD_CHANGES: "[]",
      BUILD_COMPONENT: "all",
      BUILD_WORKSPACE_GRAPH_CHANGED: "false",
      GITHUB_EVENT_NAME: "push",
      ...overrides,
    });

  // eslint-disable-next-line db21-tests/require-justification -- Node dependency graph changes must not trigger unrelated non-Node component publication.
  it("keeps Python outside Node workspace changes unless its own files changed", () => {
    expect(
      plan({
        BUILD_WORKSPACE_GRAPH_CHANGED: "true",
        BUILD_CHANGES: '["workspace_graph"]',
      }).status,
    ).toBe(0);
    expect(output()).toBe('components=["api","web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Build planning must retain direct non-workspace changes when also expanding Node graph changes.
  it("adds directly changed components to workspace changes", () => {
    expect(
      plan({
        BUILD_WORKSPACE_GRAPH_CHANGED: "true",
        BUILD_CHANGES: '["pipelines"]',
      }).status,
    ).toBe(0);
    expect(output()).toBe('components=["api","pipelines","web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Ordinary component changes must not unintentionally rebuild and publish every component.
  it("selects only direct changes without a graph change", () => {
    expect(plan({ BUILD_CHANGES: '["web"]' }).status).toBe(0);
    expect(output()).toBe('components=["web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Runs without deployable changes must emit an empty matrix instead of publishing unrelated images.
  it("supports an empty build matrix", () => {
    expect(plan().status).toBe(0);
    expect(output()).toBe("components=[]\n");
  });
  // eslint-disable-next-line db21-tests/require-justification -- Manual rebuild selection must distinguish one component from all components without depending on changed files.
  it.each(["all", "api"])(
    "supports manual component selection %s",
    (component) => {
      expect(
        plan({
          GITHUB_EVENT_NAME: "workflow_dispatch",
          BUILD_COMPONENT: component,
        }).status,
      ).toBe(0);
      expect(JSON.parse(output().slice("components=".length))).toEqual(
        component === "all" ? ["api", "web", "pipelines"] : ["api"],
      );
    },
  );
  // eslint-disable-next-line db21-tests/require-justification -- Untrusted workflow planning inputs must not introduce unknown components, unsafe identifiers, or unsupported events.
  it.each([
    { BUILD_COMPONENT: "invalid", GITHUB_EVENT_NAME: "workflow_dispatch" },
    { BUILD_CHANGES: '["unknown"]' },
    { BUILD_WORKSPACE_COMPONENTS: '["unknown"]' },
    { BUILD_WORKSPACE_GRAPH_CHANGED: "yes" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { BUILD_COMPONENTS: '["../unsafe"]' },
  ])("rejects invalid planning input %j", (overrides) => {
    expect(plan(overrides).status).not.toBe(0);
  });
});

describe("deployment submission", () => {
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

  beforeEach(() => {
    writeFileSync(
      join(directory, "make"),
      '#!/bin/bash\ncp "$DEPLOY_CURL_CONFIG" "$RUNNER_TEMP/captured"\nstat -f %Lp "$DEPLOY_CURL_CONFIG" > "$RUNNER_TEMP/mode" 2>/dev/null || stat -c %a "$DEPLOY_CURL_CONFIG" > "$RUNNER_TEMP/mode"\nprintf "%s\\n" "$@" "$IMAGE" "$REQUEST_ID" > "$RUNNER_TEMP/arguments"\nexit "${FAKE_MAKE_EXIT:-0}"\n',
      { mode: 0o700 },
    );
  });
  // eslint-disable-next-line db21-tests/require-justification -- Deployment credentials must remain private, correctly escaped, and cleaned on both success and failure.
  it.each(["0", "1"])(
    "keeps auth private and cleans it after make exits %s",
    (code) => {
      const result = submit({ FAKE_MAKE_EXIT: code });

      expect(result.status).toBe(Number(code));
      expect(result.stdout + result.stderr).not.toContain('example-"secret');
      expect(
        readdirSync(directory).filter((name) =>
          name.startsWith("deployment-access."),
        ),
      ).toEqual([]);
      expect(statSync(join(directory, "captured")).mode & 0o777).toBe(0o600);
      expect(readFileSync(join(directory, "mode"), "utf8").trim()).toBe("600");
      expect(readFileSync(join(directory, "captured"), "utf8")).toContain(
        'header = "CF-Access-Client-Secret: example-\\"secret"',
      );
      expect(readFileSync(join(directory, "captured"), "utf8")).toContain(
        'form-string = "sequence=42"',
      );
      expect(readFileSync(join(directory, "arguments"), "utf8")).toContain(
        "deploy-api\n",
      );
    },
  );
  // eslint-disable-next-line db21-tests/require-justification -- Deployment inputs must reject shell or header injection and malformed identities before creating credential files.
  it.each([
    { COMPONENT: "api;exit" },
    { IMAGE: "latest" },
    { REQUEST_ID: "short" },
    { DEPLOY_SEQUENCE: "0" },
    { DEPLOY_ATTEMPT: "bad" },
    { CF_ACCESS_CLIENT_SECRET: "bad\nheader" },
    { CF_ACCESS_CLIENT_ID: "" },
    { DEPLOY_CHANNEL: "bad\nchannel" },
  ])("rejects unsafe deployment input %j", (overrides) => {
    expect(submit(overrides).status).not.toBe(0);
    expect(readdirSync(directory)).toEqual(["make"]);
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
printf '%s\\n' "\${!#}" >> "$RUNNER_TEMP/calls"
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

  // eslint-disable-next-line db21-tests/require-justification -- Capability CI must finish on apply even with pending external verification, remove multipart fields before GET polling, and clean Access credentials.
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
  // eslint-disable-next-line db21-tests/require-justification -- A superseded configuration must not poll a nonexistent release or claim it was applied.
  it("stops after superseded admission without polling", () => {
    configurationMake();
    expect(configure({ FAKE_SUBMIT: "Superseded" }).status).toBe(0);
    expect(readFileSync(join(directory, "calls"), "utf8")).toBe("deploy-api\n");
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toContain(
      "Superseded",
    );
  });
  // eslint-disable-next-line db21-tests/require-justification -- Apply failures must fail CI rather than being mistaken for successful asynchronous capability provisioning.
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
  // eslint-disable-next-line db21-tests/require-justification -- Durable receipts appear asynchronously; an initial 404 must not turn accepted configuration into a false deployment failure.
  it("retries the short receipt materialization window", () => {
    configurationMake();
    expect(configure({ FAKE_INITIAL_404: "true" }).status).toBe(0);
    expect(
      readFileSync(join(directory, "calls"), "utf8").split("\n"),
    ).toHaveLength(4);
  });
  // eslint-disable-next-line db21-tests/require-justification -- A stuck apply must terminate within a bounded polling budget and remove its private credentials.
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
  // eslint-disable-next-line db21-tests/require-justification -- Image-bearing configuration or an unbounded timeout must be rejected before any credentials or deployment state are created.
  it.each([
    { IMAGE: digest },
    { APPLY_TIMEOUT: "0" },
    { APPLY_TIMEOUT: "3601" },
  ])("rejects invalid configuration input %j", (overrides) => {
    expect(configure(overrides).status).not.toBe(0);
    expect(readdirSync(directory)).toEqual(["make"]);
  });
});
