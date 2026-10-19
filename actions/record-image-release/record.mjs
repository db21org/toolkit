import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const {
  RELEASE_COMPONENT: component,
  RELEASE_DIGEST: image,
  RELEASE_SOURCE_SHA: sha,
  GITHUB_RUN_ATTEMPT: attempt,
  GITHUB_OUTPUT: output,
  GITHUB_STEP_SUMMARY: summary,
  RUNNER_TEMP: temporaryDirectory,
} = process.env;

assert(
  component && /^[a-z][a-z\d-]{0,62}$/u.test(component),
  "Invalid component.",
);
assert(image && /^sha256:[a-f\d]{64}$/u.test(image), "Invalid image digest.");
assert(sha && /^[a-f\d]{40}$/u.test(sha), "Invalid source SHA.");
assert(attempt && /^[1-9]\d*$/u.test(attempt), "Invalid run attempt.");
assert(
  output && summary && temporaryDirectory,
  "Expected GitHub runner paths.",
);

const directory = mkdtempSync(join(temporaryDirectory, "image-release-"));
const path = join(directory, `${component}.json`);

writeFileSync(path, `${JSON.stringify({ component, image, sha })}\n`);
appendFileSync(
  output,
  `artifact-name=image-release-${component}-attempt-${attempt}\npath=${path}\n`,
);
appendFileSync(
  summary,
  `Published \`${component}@${image}\` from \`${sha}\`.\n`,
);
