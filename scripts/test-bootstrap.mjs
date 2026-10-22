import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "db21-bootstrap-validation-"),
);
const starter = join(temporaryDirectory, "starter");
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });

try {
  const output = execFileSync(
    "npm",
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryDirectory,
    ],
    { cwd: root, encoding: "utf8" },
  );
  const [{ filename }] = JSON.parse(output);
  const archive = join(temporaryDirectory, filename);

  run(process.execPath, [
    "dist/cli/index.js",
    "bootstrap",
    starter,
    "--apps",
    "api,expo,astro-static,astro-ssr",
  ]);

  const manifestPath = join(starter, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Validate the unpublished artifact, not an older npm release.
  manifest.resolutions = {
    ...manifest.resolutions,
    "@db21/toolkit": `file:${archive}`,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    join(starter, ".yarnrc.yml"),
    "nodeLinker: node-modules\nenableImmutableInstalls: false\nenableScripts: false\n",
  );
  run("corepack", ["yarn", "install", "--mode=skip-build"], starter);

  for (const task of [
    "format",
    "format:check",
    "lint",
    "check",
    "architecture:check",
    "test",
    "build",
  ]) {
    run("corepack", ["yarn", task], starter);
  }

  run(
    "corepack",
    [
      "yarn",
      "workspace",
      "@starter/app",
      "exec",
      "expo",
      "export",
      "--platform",
      "all",
    ],
    starter,
  );

  // Use an ephemeral port so validation does not conflict with a local API.
  run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import 'reflect-metadata';
    import { NestFactory } from '@nestjs/core';
    import { AppModule } from './apps/api/dist/app.module.js';
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      await app.listen(0, '127.0.0.1');
      const response = await fetch((await app.getUrl()) + '/health');
      if (!response.ok || (await response.json()).status !== 'ok') throw new Error('Health check failed');
    } finally { await app.close(); }
  `,
    ],
    starter,
  );
  console.log(
    "Generated starters: formatting, lint, types, architecture, tests, builds, Expo platform bundles and API health passed.",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
