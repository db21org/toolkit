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

describe("stable release version", () => {
  it("removes the complete toolkit prerelease suffix", () => {
    expect(createReleaseVersion({ devVersion, latestVersion: "1.0.0" })).toBe(
      "1.0.1",
    );
  });

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

  it.each(["1.0.1", "1.0.2", "1.1.0", "2.0.0"])(
    "rejects release not newer than %s",
    (latestVersion) => {
      expect(() => createReleaseVersion({ devVersion, latestVersion })).toThrow(
        "newer than latest",
      );
    },
  );

  it("compares numeric version segments rather than strings", () => {
    expect(
      createReleaseVersion({
        devVersion: "1.0.10-dev.42.1.gabcdef123456",
        latestVersion: "1.0.9",
      }),
    ).toBe("1.0.10");
  });

  it("rejects malformed latest", () => {
    expect(() =>
      createReleaseVersion({ devVersion, latestVersion: "1.0.0-dev.1" }),
    ).toThrow("stable major.minor.patch");
  });
});

describe("release archive paths", () => {
  it("accepts regular npm package entries", () => {
    expect(() =>
      validateArchiveEntries(
        ["package/package.json", "package/dist/index.js"],
        ["-rw-r--r-- file", "drwxr-xr-x directory"],
      ),
    ).not.toThrow();
  });

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
    { mode: 0o755 },
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
  chmodSync(join(binary, "npm"), 0o755);

  return { archive, binary, manifest };
};

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
