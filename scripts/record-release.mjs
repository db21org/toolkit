import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { compareStableVersions } from "./release-version.mjs";

assert(
  process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_REF === "refs/heads/main",
  "Release versions may only be recorded on toolkit main in GitHub Actions.",
);
assert(
  process.env.GITHUB_REPOSITORY === "db21org/toolkit",
  "Release versions may only be recorded on toolkit main in GitHub Actions.",
);
const version = process.env.RELEASE_VERSION;

assert(version, "Expected the successfully published release version.");
compareStableVersions(version, version);

const endpoint = "repos/db21org/toolkit/contents/package.json";
const current = JSON.parse(
  execFileSync("gh", ["api", `${endpoint}?ref=main`], { encoding: "utf8" }),
);

assert(current.encoding === "base64", "Expected base64 package contents.");
const manifest = JSON.parse(
  Buffer.from(current.content, "base64").toString("utf8"),
);

assert(manifest.name === "@db21/toolkit", "Unexpected package on main.");
const difference = compareStableVersions(version, manifest.version);

assert(difference >= 0n, "Refusing to move the repository version backward.");

if (difference === 0n) {
  console.log(`Repository already records ${version}; no commit needed.`);
} else {
  manifest.version = version;
  execFileSync("gh", ["api", "--method", "PUT", endpoint, "--input", "-"], {
    input: JSON.stringify({
      message: `chore: record release ${version}`,
      branch: "main",
      sha: current.sha,
      content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`).toString(
        "base64",
      ),
    }),
    stdio: ["pipe", "ignore", "pipe"],
  });
  console.log(`Committed released version ${version} to main.`);
}
