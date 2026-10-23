import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPreviewVersion } from "./preview-version.mjs";

assert(
  process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_REF === "refs/heads/main",
  "Preview versions may only be prepared on main in GitHub Actions.",
);

const manifestPath = resolve(import.meta.dirname, "../package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.version = createPreviewVersion({
  stableVersion: manifest.version,
  runNumber: process.env.GITHUB_RUN_NUMBER,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  sha: process.env.GITHUB_SHA,
});
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Prepared ${manifest.name}@${manifest.version} for the dev dist-tag.`,
);
