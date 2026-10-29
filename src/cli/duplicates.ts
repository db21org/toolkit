import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { defineCommand } from "citty";

import { assert, isNotEmpty } from "../utils/index.js";

const model = "CodeRankEmbed";
const ignoredPaths = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.yarn/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/generated/**",
  "**/*.d.ts",
  "**/*.d.mts",
  "**/*.d.cts",
];

const runDetector = (args: string[]): void => {
  const require = createRequire(import.meta.url);
  const launcher = join(
    dirname(require.resolve("jscpd/package.json")),
    "run-jscpd.js",
  );
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "toolkit-duplicates-"));

  try {
    // Never inherit a repository config: it can select a remote embedding API.
    const config = join(temporaryDirectory, "config.json");

    writeFileSync(config, "{}");

    const result = spawnSync(
      process.execPath,
      [launcher, "--config", config, ...args],
      { stdio: "inherit" },
    );

    assert.notDefined(
      result.error,
      result.error ?? "Cannot start duplicate scan.",
    );
    assert.notDefined(
      result.signal,
      `Duplicate scan terminated by ${result.signal ?? "unknown signal"}.`,
    );

    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

export const duplicatesCommand = defineCommand({
  meta: {
    description: "Find potential duplicate functions (advisory, local only)",
  },
  args: {
    directory: {
      type: "positional",
      description: "File or directory to scan",
      default: ".",
      required: false,
    },
    semantic: {
      type: "boolean",
      description:
        "Use local CodeRankEmbed embeddings instead of AST similarity",
      default: false,
    },
    "download-model": {
      type: "boolean",
      description: "Download CodeRankEmbed (~548 MB) to local cache, then exit",
      default: false,
    },
    ignore: {
      type: "string",
      description: "Additional comma-separated file globs to exclude",
      default: "",
    },
    reporters: {
      type: "string",
      description: "jscpd reporters, e.g. console,json or json,ai",
      default: "console",
    },
    output: {
      type: "string",
      description:
        "Directory for file reports (only written by file reporters)",
      default: ".toolkit/duplicates",
    },
  },
  run({ args }) {
    if (args["download-model"]) {
      runDetector(["--semantic-download", model]);

      return;
    }

    const detection = args.semantic
      ? [
          "--semantic",
          "--semantic-provider=local",
          `--semantic-model=${model}`,
          "--semantic-scope=same",
          "--kind=semantic",
        ]
      : ["--similarity=0.8", "--kind=exact,ast"];

    const extraIgnore = args.ignore
      .split(",")
      .map((pattern) => pattern.trim())
      .filter(isNotEmpty);
    const ignore = [...ignoredPaths, ...extraIgnore];

    runDetector([
      ...detection,
      "--min-lines=8",
      "--min-tokens=80",
      "--mode=weak",
      `--ignore=${ignore.join(",")}`,
      `--reporters=${args.reporters}`,
      `--output=${resolve(args.output)}`,
      "--fail-on-empty",
      "--no-tips",
      resolve(args.directory),
    ]);
  },
});
