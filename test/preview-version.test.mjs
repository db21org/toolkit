import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: preview numbering ignores recorded stable releases or requires registry availability; Contract: CI derives next patch from its own package manifest without npm access and changes no other manifest fields.
it("derives preview from recorded stable version without registry access", () => {
  const directory = mkdtempSync(join(tmpdir(), "toolkit-preview-version-"));

  try {
    const scripts = join(directory, "scripts");

    mkdirSync(scripts);

    for (const script of ["prepare-preview.mjs", "preview-version.mjs"]) {
      copyFileSync(resolve("scripts", script), join(scripts, script));
    }

    const manifest = {
      name: "@db21/toolkit",
      version: "1.2.9",
      scripts: { build: "unchanged" },
    };
    const manifestPath = join(directory, "package.json");

    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(
      join(directory, "npm"),
      '#!/usr/bin/env node\nthrow new Error("Registry access forbidden");\n',
    );
    chmodSync(join(directory, "npm"), executableFileMode);
    execFileSync(process.execPath, [join(scripts, "prepare-preview.mjs")], {
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/main",
        GITHUB_RUN_NUMBER: "42",
        GITHUB_RUN_ATTEMPT: "2",
        GITHUB_SHA: "abcdef1234567890abcdef1234567890abcdef12",
      },
    });
    expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toEqual({
      ...manifest,
      version: "1.2.10-dev.42.2.gabcdef123456",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
