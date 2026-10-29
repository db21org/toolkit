import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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
const shaLength = 40;
const digestHexLength = 64;
const executableFileMode = 0o700;
const permissionMask = 0o777;
const privateFileMode = 0o600;
const sha = "a".repeat(shaLength);
const digest = `sha256:${"b".repeat(digestHexLength)}`;
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

const record = (overrides = {}) =>
  run("record-image-release/record.mjs", {
    RELEASE_COMPONENT: "api",
    RELEASE_DIGEST: digest,
    RELEASE_SOURCE_SHA: sha,
    GITHUB_RUN_ATTEMPT: "1",
    ...overrides,
  });

const invalidReceiptInputs = [
  ["RELEASE_COMPONENT", "../escape"],
  ["RELEASE_DIGEST", "latest"],
  ["RELEASE_SOURCE_SHA", "abc"],
  ["GITHUB_RUN_ATTEMPT", "0"],
];

const malformedReceipts = [
  { component: "api", image: digest, sha: "c".repeat(shaLength) },
  { component: "other", image: digest, sha },
  { component: "api", image: "latest", sha },
  { component: "api", image: digest, sha, extra: true },
  null,
];

describe("image release receipts", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: deployment selects an image from the wrong commit or retry; Contract: receipts bind the immutable digest and source SHA under an attempt-specific artifact name.
  it("records the immutable digest and source under an attempt-scoped artifact name", () => {
    const result = record({ GITHUB_RUN_ATTEMPT: "2" });

    expect(result.status).toBe(0);
    expect(output()).toContain("artifact-name=image-release-api-attempt-2\n");
    const path = output().split("path=")[1].trim();

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      component: "api",
      image: digest,
      sha,
    });
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: invalid publication inputs escape artifact paths or deploy mutable images; Contract: unsafe component, digest, source and attempt inputs fail before writing files.
  it.each(invalidReceiptInputs)(
    "rejects invalid %s before writing a receipt",
    (key, value) => {
      const result = record({ [key]: value });

      expect(result.status).not.toBe(0);
      expect(readdirSync(directory)).toEqual([]);
    },
  );
  // eslint-disable-next-line db21-tests/require-justification -- Risk: partial publication deploys images that were never published; Contract: collecting no receipts succeeds with an empty deployment matrix.
  it("returns an empty matrix when a partial publication has no receipts", () => {
    expect(collect().status).toBe(0);
    expect(output()).toBe("images=[]\n");
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: identical receipt filenames discard a separately published component; Contract: collection preserves both releases from separate artifact directories.
  it("collects valid receipts without merging artifact directories", () => {
    receipt("first", { component: "api", image: digest, sha });
    receipt("second", { component: "web", image: digest, sha });
    expect(collect().status).toBe(0);
    expect(JSON.parse(output().slice("images=".length))).toEqual([
      { component: "api", image: digest, sha },
      { component: "web", image: digest, sha },
    ]);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: forged or malformed receipts authorize unintended deployments; Contract: collection rejects wrong commits, unknown components, mutable images and invalid envelopes.
  it.each(malformedReceipts)(
    "rejects forged or malformed receipt %j",
    (value) => {
      receipt("one", value);
      expect(collect().status).not.toBe(0);
    },
  );
  // eslint-disable-next-line db21-tests/require-justification -- Risk: duplicate releases choose a deployment image by artifact traversal order; Contract: repeated component receipts fail instead of silently selecting either entry.
  it("rejects duplicate components even with identical receipt filenames", () => {
    receipt("one", { component: "api", image: digest, sha });
    receipt("two", { component: "api", image: digest, sha });
    expect(collect().status).not.toBe(0);
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: artifact symlinks import a valid but unauthorized external receipt; Contract: collection rejects the link itself without consuming or changing its existing target.
  it("rejects symlink receipts", () => {
    receipt("one", { component: "api", image: digest, sha });
    const path = join(directory, "receipts", "one", "api.json");
    const external = join(directory, "external-receipt.json");
    const contents = JSON.stringify({ component: "api", image: digest, sha });

    writeFileSync(external, contents);
    rmSync(path);
    symlinkSync(external, path);
    const result = collect();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unexpected receipt artifact file.");
    expect(readFileSync(external, "utf8")).toBe(contents);
  });
});

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

describe("image build planning", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: Node graph changes unnecessarily publish unrelated Python components; Contract: a workspace-only change selects exactly the configured Node workspaces.
  it("keeps Python outside Node workspace changes unless its own files changed", () => {
    expect(
      plan({
        BUILD_WORKSPACE_GRAPH_CHANGED: "true",
        BUILD_CHANGES: '["workspace_graph"]',
      }).status,
    ).toBe(0);
    expect(output()).toBe('components=["api","web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: a combined workspace and Python change omits a required image build; Contract: planning includes directly changed components alongside affected Node workspaces.
  it("adds directly changed components to workspace changes", () => {
    expect(
      plan({
        BUILD_WORKSPACE_GRAPH_CHANGED: "true",
        BUILD_CHANGES: '["pipelines"]',
      }).status,
    ).toBe(0);
    expect(output()).toBe('components=["api","pipelines","web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: an isolated change triggers unrelated image publication; Contract: planning without a graph change selects only the directly changed component.
  it("selects only direct changes without a graph change", () => {
    expect(plan({ BUILD_CHANGES: '["web"]' }).status).toBe(0);
    expect(output()).toBe('components=["web"]\n');
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: no-op pushes publish unrelated images; Contract: planning without deployable changes emits an empty build matrix.
  it("supports an empty build matrix", () => {
    expect(plan().status).toBe(0);
    expect(output()).toBe("components=[]\n");
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: a manual rebuild targets the wrong release components; Contract: explicit one-component and all-component selections work independently of changed files.
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
  // eslint-disable-next-line db21-tests/require-justification -- Risk: untrusted workflow inputs schedule unauthorized component builds; Contract: unknown components, unsafe identifiers, invalid flags and unsupported events fail planning.
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

describe("deployment submission", () => {
  beforeEach(() => {
    writeFileSync(
      join(directory, "make"),
      '#!/bin/bash\ncp "$DEPLOY_CURL_CONFIG" "$RUNNER_TEMP/captured"\nstat -f %Lp "$DEPLOY_CURL_CONFIG" > "$RUNNER_TEMP/mode" 2>/dev/null || stat -c %a "$DEPLOY_CURL_CONFIG" > "$RUNNER_TEMP/mode"\nprintf "%s\\n" "$@" "$IMAGE" "$REQUEST_ID" > "$RUNNER_TEMP/arguments"\nexit "${FAKE_MAKE_EXIT:-0}"\n',
      { mode: executableFileMode },
    );
  });
  // eslint-disable-next-line db21-tests/require-justification -- Risk: deployment credentials leak through logs, permissions or leftover files; Contract: submission escapes private credentials, uses mode 0600 and cleans temporary auth on success and failure.
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
      expect(statSync(join(directory, "captured")).mode & permissionMask).toBe(
        privateFileMode,
      );
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
  // eslint-disable-next-line db21-tests/require-justification -- Risk: malformed deployment inputs inject shell commands or HTTP headers; Contract: unsafe identities, channels and credentials fail before any private auth file is created.
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
});
