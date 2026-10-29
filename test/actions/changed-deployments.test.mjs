import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const actions = fileURLToPath(new URL("../../actions/", import.meta.url));
const shaLength = 40;
const executableFileMode = 0o700;
const sha = "a".repeat(shaLength);
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

const output = () => readFileSync(env.GITHUB_OUTPUT, "utf8");

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

describe("changed deployment selection", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: a first deployment can omit an application or publish namespace setup; Contract: no-base selection emits every application and excludes namespace as its own component.
  it("selects all existing applications without a base revision", () => {
    expect(select().status).toBe(0);
    expect(output()).toBe('components=["admin","api"]\n');
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: changed files can deploy the wrong application or miss namespace fan-out; Contract: file diffs select only affected applications and ignore unrelated files.
  it.each([
    ["deploy/api.yaml", '["api"]'],
    ["deploy/namespace.yaml", '["admin","api"]'],
    ["README.md", "[]"],
  ])("selects applications for %s", (file, expected) => {
    writeFileSync(
      join(directory, "git"),
      `#!/bin/bash\nprintf '%s\\0' '${file}'\n`,
      { mode: executableFileMode },
    );
    expect(select(sha).status).toBe(0);
    expect(output()).toBe(`components=${expected}\n`);
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: deleted deployment declarations could silently remove infrastructure ownership; Contract: deletion or rename input fails with an explicit teardown-review error.
  it("rejects deleted or renamed deployment declarations", () => {
    writeFileSync(
      join(directory, "git"),
      "#!/bin/bash\nprintf 'deploy/removed.yaml\\0'\n",
      { mode: executableFileMode },
    );
    const result = select(sha);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicit ownership and teardown review");
  });
});
