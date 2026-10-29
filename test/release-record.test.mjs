import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { expect, it } from "vitest";

const executableFileMode = 0o755;

const createGitHubFixture = (directory) => {
  const binary = join(directory, "bin");

  mkdirSync(binary);
  writeFileSync(
    join(binary, "gh"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.join(" ") === "api repos/db21org/toolkit/contents/package.json?ref=main") {
  console.log(JSON.stringify({ encoding: "base64", sha: "current-blob", content: Buffer.from(process.env.CURRENT_MANIFEST).toString("base64") }));
} else if (args.join(" ") === "api --method PUT repos/db21org/toolkit/contents/package.json --input -") {
  fs.writeFileSync(process.env.RECORDED_REQUEST, fs.readFileSync(0));
  if (process.env.CONFLICT === "true") throw new Error("409 concurrent package change");
} else {
  throw new Error("Unexpected GitHub request");
}
`,
  );
  chmodSync(join(binary, "gh"), executableFileMode);

  return binary;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: release bookkeeping overwrites concurrent package edits or rolls version backward; Contract: main update preserves all other manifest fields, uses current blob SHA, skips duplicates and fails closed on conflicts or invalid execution context.
it.each([
  { current: "1.0.9", released: "1.0.10", writes: true, succeeds: true },
  { current: "1.0.10", released: "1.0.10", writes: false, succeeds: true },
  { current: "1.0.11", released: "1.0.10", writes: false, succeeds: false },
  {
    current: "1.0.9",
    released: "1.0.10",
    conflict: true,
    writes: true,
    succeeds: false,
  },
  {
    current: "1.0.9",
    released: "1.0.10-dev.1",
    writes: false,
    succeeds: false,
  },
  {
    current: "1.0.9",
    released: "1.0.10",
    ref: "refs/heads/other",
    writes: false,
    succeeds: false,
  },
])(
  "records released version safely: %j",
  ({ current, released, conflict, ref, writes, succeeds }) => {
    const directory = mkdtempSync(join(tmpdir(), "toolkit-record-release-"));

    try {
      const binary = createGitHubFixture(directory);
      const request = join(directory, "request.json");
      const manifest = {
        name: "@db21/toolkit",
        version: current,
        scripts: { build: "unchanged" },
      };

      const result = spawnSync(
        process.execPath,
        [resolve("scripts/record-release.mjs")],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${binary}${delimiter}${process.env.PATH}`,
            GITHUB_ACTIONS: "true",
            GITHUB_REF: ref ?? "refs/heads/main",
            GITHUB_REPOSITORY: "db21org/toolkit",
            RELEASE_VERSION: released,
            CURRENT_MANIFEST: JSON.stringify(manifest),
            RECORDED_REQUEST: request,
            CONFLICT: String(conflict ?? false),
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status === 0, result.stderr).toBe(succeeds);
      expect(existsSync(request)).toBe(writes);

      if (writes) {
        const body = JSON.parse(readFileSync(request, "utf8"));

        expect(body).toEqual({
          message: `chore: record release ${released}`,
          branch: "main",
          sha: "current-blob",
          content: expect.any(String),
        });
        expect(
          JSON.parse(Buffer.from(body.content, "base64").toString("utf8")),
        ).toEqual({ ...manifest, version: released });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
