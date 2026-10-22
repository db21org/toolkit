import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createReleaseVersion,
  validateArchiveEntries,
} from "./release-version.mjs";

assert(
  process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_REF === "refs/heads/main",
  "Stable releases may only be prepared on main in GitHub Actions.",
);
assert(process.env.GITHUB_OUTPUT, "Expected GitHub Actions output file.");

const registry = "--registry=https://registry.npmjs.org/";
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8" });

const view = (specifier, field) =>
  JSON.parse(
    run("npm", [
      "view",
      specifier,
      ...(field ? [field] : []),
      "--json",
      registry,
    ]),
  );

const { name } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
);
const preview = view(`${name}@dev`);
const version = createReleaseVersion({
  devVersion: preview.version,
  latestVersion: view(`${name}@latest`, "version"),
});

assert(preview.name === name, "Unexpected package name from npm.");

const directory = mkdtempSync(
  join(process.env.RUNNER_TEMP ?? tmpdir(), "toolkit-release-"),
);

try {
  // Resolve dev once, then fetch that immutable version with lifecycle scripts disabled.
  const [packed] = JSON.parse(
    run(
      "npm",
      [
        "pack",
        `${name}@${preview.version}`,
        "--ignore-scripts",
        "--json",
        registry,
      ],
      directory,
    ),
  );

  assert(
    packed.filename ===
      `${name.replace("@", "").replace("/", "-")}-${preview.version}.tgz`,
    "Unexpected npm archive filename.",
  );
  const archive = join(directory, packed.filename);
  validateArchiveEntries(
    run("tar", ["-tzf", archive]).trimEnd().split("\n"),
    run("tar", ["-tvzf", archive]).trimEnd().split("\n"),
  );
  const extracted = join(directory, "extracted");

  mkdirSync(extracted);
  run("tar", [
    "-xzf",
    archive,
    "-C",
    extracted,
    "--no-same-owner",
    "--no-same-permissions",
  ]);
  const manifestPath = join(extracted, "package/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  assert(
    manifest.name === name && manifest.version === preview.version,
    "Archive manifest does not match selected dev version.",
  );
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const releaseArchive = join(directory, `release-${version}.tgz`);

  // Repack the built files directly: never rebuild or run downloaded package scripts.
  run("tar", ["-czf", releaseArchive, "-C", extracted, "package"]);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `archive=${releaseArchive}\nversion=${version}\ndev-version=${preview.version}\n`,
  );
  console.log(
    `Prepared ${name}@${version} from ${preview.version}; no package code rebuilt.`,
  );
} catch (error) {
  rmSync(directory, { recursive: true, force: true });
  throw error;
}
