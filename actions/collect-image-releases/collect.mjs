import assert from "node:assert/strict";
import { appendFileSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const {
  RELEASE_DIRECTORY: directory,
  RELEASE_SOURCE_SHA: sha,
  RELEASE_COMPONENTS: componentsJson,
  GITHUB_OUTPUT: output,
  GITHUB_STEP_SUMMARY: summary,
} = process.env;

assert(directory && output && summary, "Expected GitHub runner paths.");
assert(sha && /^[a-f\d]{40}$/u.test(sha), "Invalid source SHA.");

const components = JSON.parse(componentsJson ?? "null");

assert(
  Array.isArray(components) &&
    components.every(
      (value) =>
        typeof value === "string" && /^[a-z][a-z\d-]{0,62}$/u.test(value),
    ),
  "Invalid component allowlist.",
);

const images = [];
const seen = new Set();

// download-artifact creates one directory per artifact, preserving duplicates.
for (const artifact of readdirSync(directory).toSorted((left, right) =>
  left.localeCompare(right),
)) {
  const artifactPath = join(directory, artifact);

  assert(
    lstatSync(artifactPath).isDirectory(),
    "Expected a receipt artifact directory.",
  );

  for (const file of readdirSync(artifactPath).toSorted((left, right) =>
    left.localeCompare(right),
  )) {
    const path = join(artifactPath, file);

    assert(
      file.endsWith(".json") && lstatSync(path).isFile(),
      "Unexpected receipt artifact file.",
    );

    const receipt = JSON.parse(readFileSync(path, "utf8"));

    assert(
      receipt && typeof receipt === "object" && !Array.isArray(receipt),
      "Invalid image publication receipt.",
    );
    assert(
      receipt.sha === sha && components.includes(receipt.component),
      "Invalid image publication receipt.",
    );
    assert(
      typeof receipt.image === "string" &&
        /^sha256:[a-f\d]{64}$/u.test(receipt.image),
      "Invalid image publication receipt.",
    );
    assert(
      Object.keys(receipt)
        .toSorted((left, right) => left.localeCompare(right))
        .join(",") === "component,image,sha",
      "Invalid image publication receipt.",
    );
    assert(!seen.has(receipt.component), "Duplicate receipt component.");
    seen.add(receipt.component);
    images.push(receipt);
  }
}

appendFileSync(output, `images=${JSON.stringify(images)}\n`);
appendFileSync(
  summary,
  `Selected image releases: \`${JSON.stringify(images)}\`\n`,
);
