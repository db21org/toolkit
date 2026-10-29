import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "db21-toolkit-pack-"));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const run = (command, args, cwd = temporaryDirectory, stdio = "inherit") =>
  execFileSync(command, args, { cwd, stdio });

try {
  const archive = join(
    temporaryDirectory,
    `db21-toolkit-${manifest.version}.tgz`,
  );

  // test:pack builds first; inspect the exact npm artifact without rebuilding.
  run(
    "npm",
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryDirectory,
    ],
    root,
    ["ignore", "ignore", "inherit"],
  );

  // Install only the artifact and explicit integration hosts, outside this checkout.
  // Source aliases, unpublished files and root devDependencies cannot rescue it.
  const hostPackages = [
    "@prisma/client",
    "@types/node",
    "@types/react",
    "dependency-cruiser",
    "eslint",
    "graphql",
    "react",
    "typescript",
    "zod",
  ];

  const dependencies = Object.fromEntries(
    hostPackages.map((name) => [
      name,
      JSON.parse(
        readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
      ).version,
    ]),
  );

  const consumerManifest = {
    name: "toolkit-artifact-consumer",
    private: true,
    type: "module",
    packageManager: manifest.packageManager,
    dependencies: { "@db21/toolkit": `file:${archive}` },
  };

  const consumerManifestPath = join(temporaryDirectory, "package.json");

  writeFileSync(consumerManifestPath, JSON.stringify(consumerManifest));
  writeFileSync(
    join(temporaryDirectory, ".yarnrc.yml"),
    // These disposable installs intentionally create and update their own lockfile.
    "nodeLinker: node-modules\nenableScripts: false\nenableImmutableInstalls: false\n",
  );
  cpSync(join(root, "test/package"), temporaryDirectory, { recursive: true });
  writeFileSync(
    join(temporaryDirectory, "exports.json"),
    JSON.stringify(manifest.exports),
  );
  run("corepack", ["yarn", "install", "--mode=skip-build"]);
  run("node", ["runtime-only.mjs"]);
  run("node", ["outbox-schema.mjs"]);
  run("corepack", ["yarn", "toolkit", "--help"]);
  // Resolve the native detector from the installed artifact, without devDependencies.
  run("corepack", ["yarn", "toolkit", "duplicates", "runtime-only.mjs"]);
  run("corepack", ["yarn", "toolkit", "agents", "init"]);
  run("corepack", ["yarn", "toolkit", "agents", "init"]);
  const instructions = readFileSync(
    join(temporaryDirectory, "AGENTS.md"),
    "utf8",
  );
  const segmentsWithOnePolicyMarker = 2;

  assert.equal(
    instructions.split("<!-- db21-toolkit:test-policy -->").length,
    segmentsWithOnePolicyMarker,
    "Packed agent initializer must add exactly one policy section.",
  );

  readFileSync(
    join(temporaryDirectory, "node_modules/@db21/toolkit/docs/test-policy.md"),
    "utf8",
  );
  run("corepack", [
    "yarn",
    "toolkit",
    "bootstrap",
    "generated-starter",
    "--apps",
    "api,expo,astro-static,astro-ssr",
  ]);

  for (const file of [
    "package.json",
    "AGENTS.md",
    ".yarnrc.yml",
    ".github/workflows/validate.yml",
    "apps/api/src/main.ts",
    "apps/app/app.json",
    "apps/landing/astro.config.mjs",
    "apps/site/astro.config.mjs",
  ]) {
    readFileSync(join(temporaryDirectory, "generated-starter", file), "utf8");
  }

  consumerManifest.dependencies = {
    ...consumerManifest.dependencies,
    ...dependencies,
  };
  writeFileSync(consumerManifestPath, JSON.stringify(consumerManifest));
  run("corepack", ["yarn", "install", "--mode=skip-build"]);
  run("node", ["smoke.mjs"]);
  run("corepack", ["yarn", "tsc", "--project", "tsconfig.json"]);
  console.log(
    "Packed artifact: imports, CommonJS, declarations and React augmentation passed.",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
