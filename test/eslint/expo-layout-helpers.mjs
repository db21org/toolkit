import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createExpoConfig } from "@db21/toolkit/eslint/expo";
import { createNestConfig } from "@db21/toolkit/eslint/nest";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";

const sourceConfig = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  languageOptions: { parser: typescriptEslint.parser },
};

export const utilitySource =
  'const normalize = (value: string): string => value;\n\nnormalize("value");\n';

export const createCustomLayoutEslints = (cwd) => {
  const catalog = resolve(cwd, "lib/domains/catalog");

  mkdirSync(resolve(catalog, "adapters"), { recursive: true });
  mkdirSync(resolve(catalog, "misc"), { recursive: true });
  mkdirSync(resolve(cwd, "lib/shared"), { recursive: true });
  writeFileSync(resolve(cwd, "tsconfig.json"), '{"include":["lib"]}');
  writeFileSync(resolve(catalog, "catalog.module.ts"), "export {};\n");
  writeFileSync(
    resolve(catalog, "adapters/catalog.adapter.ts"),
    "export const CATALOG_ADAPTER = 1;\n",
  );
  writeFileSync(
    resolve(catalog, "misc/catalog.adapter.ts"),
    "export const CATALOG_ADAPTER = 1;\n",
  );
  writeFileSync(resolve(cwd, "lib/shared/normalize.ts"), utilitySource);
  writeFileSync(resolve(catalog, "normalize.ts"), utilitySource);

  const layout = { cwd, sourceRoot: "lib", moduleRoots: ["lib/domains"] };
  const expoConfigs = createExpoConfig({
    ...layout,
    allowedFolders: ["services", "adapters"],
    additionalRoles: [
      {
        case: "kebab",
        extensions: [".ts"],
        folder: "adapters",
        suffix: ".adapter",
      },
    ],
    graphql: { documentExtensions: ["graphql"], graphqlDirectory: "documents" },
  });

  return {
    expoEslint: new ESLint({
      cwd,
      ignore: false,
      overrideConfig: [sourceConfig, ...expoConfigs],
      overrideConfigFile: true,
    }),
    nestEslint: new ESLint({
      cwd,
      ignore: false,
      overrideConfig: [
        sourceConfig,
        ...createNestConfig({ ...layout, utilityExemptPaths: ["lib/shared"] }),
      ],
      overrideConfigFile: true,
    }),
  };
};
