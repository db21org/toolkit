import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync } from "node:fs";
import path from "node:path";

const directory = process.env.DEPLOY_DIRECTORY || "deploy";

assert(
  /^[a-zA-Z0-9_./-]+$/.test(directory) &&
    !path.isAbsolute(directory) &&
    !directory.split("/").includes(".."),
  "Deployment directory must be repository-relative",
);

const normalized = path.normalize(directory).replace(/\/$/, "");
const prefix = normalized === "." ? "" : `${normalized}/`;
const before = process.env.BEFORE || "";
const after = process.env.AFTER || "HEAD";
const all = readdirSync(directory, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() && /^[a-z][a-z0-9-]{0,62}\.ya?ml$/.test(entry.name),
  )
  .map((entry) => `${prefix}${entry.name}`);
let changed = all;

if (before && !/^0+$/.test(before)) {
  // Argument arrays and end-of-options prevent revision/path shell injection.
  changed = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "-z",
      "--no-renames",
      "--end-of-options",
      before,
      after,
      "--",
      directory,
    ],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const removed = changed.filter(
    (file) =>
      path.dirname(file) === normalized &&
      /\.ya?ml$/.test(file) &&
      !all.includes(file),
  );

  assert.deepEqual(
    removed,
    [],
    "Deployment deletion/rename needs explicit ownership and teardown review",
  );
}

const namespaceChanged = changed.some((file) =>
  /^namespace\.ya?ml$/.test(file.slice(prefix.length)),
);

const components = [
  ...new Set(
    all
      .filter((file) => namespaceChanged || changed.includes(file))
      .map((file) => path.basename(file).replace(/\.ya?ml$/, ""))
      .filter((name) => name !== "namespace"),
  ),
].toSorted((left, right) => left.localeCompare(right));

appendFileSync(
  process.env.GITHUB_OUTPUT,
  `components=${JSON.stringify(components)}\n`,
);
