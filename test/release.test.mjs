import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createReleaseVersion,
  validateArchiveEntries,
} from "../scripts/release-version.mjs";

const devVersion = "1.0.1-dev.42.1.gabcdef123456";
const executableFileMode = 0o755;

describe("stable release version", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: arbitrary prereleases are promoted as unintended stable versions; Contract: only the exact toolkit CI preview format is accepted for promotion.
  it.each([
    "1.0.1",
    "1.0.1-beta.1",
    "1.0.1-dev.0.1.gabcdef123456",
    "1.0.1-dev.42.1.gabc",
    "01.0.1-dev.42.1.gabcdef123456",
  ])("rejects unexpected dev version %s", (version) => {
    expect(() =>
      createReleaseVersion({ devVersion: version, latestVersion: "1.0.0" }),
    ).toThrow("toolkit preview version format");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: stable publication reuses a version or moves latest backward; Contract: equal and newer latest tags block promotion across patch, minor and major boundaries.
  it.each(["1.0.1", "1.0.2", "1.1.0", "2.0.0"])(
    "rejects release not newer than %s",
    (latestVersion) => {
      expect(() => createReleaseVersion({ devVersion, latestVersion })).toThrow(
        "newer than latest",
      );
    },
  );

  // eslint-disable-next-line db21-tests/require-justification -- Risk: lexical version comparison rejects a legitimate multi-digit release; Contract: promotion strips the complete CI suffix and accepts patch ten after patch nine using numeric ordering.
  it("compares numeric version segments rather than strings", () => {
    expect(
      createReleaseVersion({
        devVersion: "1.0.10-dev.42.1.gabcdef123456",
        latestVersion: "1.0.9",
      }),
    ).toBe("1.0.10");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: a malformed latest tag bypasses monotonic stable-version protection; Contract: promotion refuses a latest version outside the stable major.minor.patch format.
  it("rejects malformed latest", () => {
    expect(() =>
      createReleaseVersion({ devVersion, latestVersion: "1.0.0-dev.1" }),
    ).toThrow("stable major.minor.patch");
  });
});

describe("release archive paths", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Risk: downloaded package archives write outside the extraction directory; Contract: archive validation rejects absolute, traversal and backslash paths before extraction.
  it.each([
    "../outside",
    "package/../../outside",
    "/package/outside",
    "package/..\\outside",
  ])("rejects unsafe path %s", (path) => {
    expect(() =>
      validateArchiveEntries(
        ["package/package.json", path],
        ["-rw-r--r-- file"],
      ),
    ).toThrow("Unsafe package archive path");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: archive links redirect extraction writes outside staging; Contract: symlink and hardlink entries are rejected before archive extraction.
  it.each(["lrwxr-xr-x link", "hrw-r--r-- link"])(
    "rejects links: %s",
    (entry) => {
      expect(() =>
        validateArchiveEntries(["package/package.json"], [entry]),
      ).toThrow("only files and directories");
    },
  );
});

const createFixture = (directory) => {
  const source = join(directory, "source");
  const packageDirectory = join(source, "package");
  const manifest = {
    name: "@db21/toolkit",
    version: devVersion,
    scripts: { prepack: "exit 99" },
  };

  mkdirSync(join(packageDirectory, "dist"), { recursive: true });
  writeFileSync(
    join(packageDirectory, "package.json"),
    JSON.stringify(manifest),
  );
  writeFileSync(
    join(packageDirectory, "dist/index.js"),
    "export const built = true;\n",
    { mode: executableFileMode },
  );
  writeFileSync(join(packageDirectory, ".example"), "preserved\n");
  const archive = join(directory, "preview.tgz");

  execFileSync("tar", ["-czf", archive, "-C", source, "package"]);
  // A local npm stand-in keeps this integration test offline and unable to publish.
  const binary = join(directory, "bin");

  mkdirSync(binary);
  writeFileSync(
    join(binary, "npm"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "view") {
  console.log(JSON.stringify(args[2] === "version" ? "1.0.0" : ${JSON.stringify(manifest)}));
} else if (args[0] === "pack" && args.includes("--ignore-scripts") && args[1] === "@db21/toolkit@${devVersion}") {
  const filename = "db21-toolkit-${devVersion}.tgz";
  fs.copyFileSync(process.env.PREVIEW_ARCHIVE, filename);
  console.log(JSON.stringify([{ filename }]));
} else {
  throw new Error("Unexpected npm invocation");
}
`,
  );
  chmodSync(join(binary, "npm"), executableFileMode);

  return { archive, binary, manifest };
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: stable promotion rebuilds unreviewed code or executes package lifecycle hooks; Contract: offline promotion accepts the real archive and changes only its manifest version while preserving built bytes and dotfiles without lifecycle execution.
it("promotes the built archive offline, changing only manifest version", () => {
  const directory = mkdtempSync(join(tmpdir(), "toolkit-release-test-"));

  try {
    const { archive, binary, manifest } = createFixture(directory);
    const output = join(directory, "outputs");

    execFileSync(process.execPath, [resolve("scripts/prepare-release.mjs")], {
      env: {
        ...process.env,
        PATH: `${binary}${delimiter}${process.env.PATH}`,
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/main",
        GITHUB_OUTPUT: output,
        RUNNER_TEMP: directory,
        PREVIEW_ARCHIVE: archive,
      },
    });
    const outputs = Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );

    const readEntry = (path) =>
      execFileSync("tar", ["-xOzf", outputs.archive, path], {
        encoding: "utf8",
      });

    expect(outputs.version).toBe("1.0.1");
    expect(outputs["dev-version"]).toBe(devVersion);
    expect(JSON.parse(readEntry("package/package.json"))).toEqual({
      ...manifest,
      version: "1.0.1",
    });
    expect(readEntry("package/dist/index.js")).toBe(
      "export const built = true;\n",
    );
    expect(readEntry("package/.example")).toBe("preserved\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
