import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { defineConfig } from "tsup";

const root = import.meta.dirname;
const sourceRoot = resolve(root, "src");
const outputRoot = resolve(root, "dist");

// Authored configs and their declarations are already publishable ESM files.
const copyConfigs = (directory: string): void => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);

    if (entry.isDirectory()) {
      copyConfigs(source);
    } else if (source.endsWith(".mjs") || source.endsWith(".d.mts")) {
      const target = join(outputRoot, relative(sourceRoot, source));

      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
};

export default defineConfig(() => {
  // Clean once before parallel ESM/CJS builds, never once per build target.
  rmSync(outputRoot, { recursive: true, force: true });

  const shared = {
    // tsup's declaration bundler injects baseUrl, deprecated by TypeScript 6.
    dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
    external: [/^@db21\/toolkit(?:\/|$)/u],
    sourcemap: false,
    target: "es2022",
    tsconfig: "tsconfig.build.json",
    outDir: outputRoot,
  };

  const runtimeEntries = {
    "prisma/outbox/index": "src/prisma/outbox/index.ts",
    "events/index": "src/events/index.ts",
    "utils/index": "src/utils/index.ts",
    "money/index": "src/money/index.ts",
  };

  return [
    {
      ...shared,
      entry: { "prisma/outbox/config": "src/prisma/outbox/config.ts" },
      format: ["esm", "cjs"],
      splitting: false,
    },
    {
      ...shared,
      entry: {
        "cli/index": "src/cli/index.ts",
        "cli/bootstrap": "src/cli/bootstrap.ts",
      },
      format: ["esm"],
      splitting: false,
      dts: false,
    },
    {
      ...shared,
      entry: {
        ...runtimeEntries,
        "feature-kit/core/index": "src/feature-kit/core/index.ts",
        "feature-kit/react/index": "src/feature-kit/react/index.ts",
        "eslint/base/index": "src/eslint/base/index.ts",
        // Preserve internal rule-test imports without adding package exports.
        "eslint/base/rules": "src/eslint/base/rules.ts",
        "eslint/base/react-conventions": "src/eslint/base/react-conventions.ts",
      },
      format: ["esm"],
      splitting: true,
      onSuccess: (): Promise<void> => {
        copyConfigs(sourceRoot);

        return Promise.resolve();
      },
    },
    {
      ...shared,
      entry: runtimeEntries,
      format: ["cjs"],
      splitting: false,
    },
  ];
});
