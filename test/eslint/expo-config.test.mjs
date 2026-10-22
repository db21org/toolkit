import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import {
  createExpoConfig,
  createExpoFeatureKitConfig,
  expoRestrictedSyntax,
} from "../../src/eslint/expo.mjs";
import { createNestConfig } from "../../src/eslint/nest.mjs";

const appRoot = resolve(import.meta.dirname, "../fixtures/expo");
const sourceConfig = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  languageOptions: {
    parser: typescriptEslint.parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
};

// eslint-disable-next-line db21-tests/require-justification -- Configured navigation must block Expo Router imports while allowing the consumer-owned replacement hook.
test("allows a configured navigation hook while rejecting Expo Router", async () => {
  const configs = createExpoConfig({
    cwd: appRoot,
    navigationHook: {
      file: "src/navigation/use-navigation.hook.ts",
      importSource: "@/navigation",
      name: "useNavigation",
    },
  });

  const restrictionConfig = configs.find(
    (config) =>
      config.files?.includes("src/**/*.{ts,tsx}") &&
      Array.isArray(config.rules?.["no-restricted-imports"]),
  );

  const configuredEslint = new ESLint({
    ignore: false,
    overrideConfig: [sourceConfig, restrictionConfig],
    overrideConfigFile: true,
  });
  const filePath = "src/features/feed/components/Feed.tsx";
  const [allowed, restricted] = await Promise.all([
    configuredEslint.lintText(
      'import { useNavigation } from "@/navigation";\nuseNavigation();',
      { filePath },
    ),
    configuredEslint.lintText(
      'import { useRouter } from "expo-router";\nuseRouter();',
      { filePath },
    ),
  ]);

  assert.equal(
    allowed[0].messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    ),
    false,
  );
  assert.equal(
    restricted[0].messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    ),
    true,
  );
});

const restrictedSyntaxEslint = new ESLint({
  ignore: false,
  overrideConfig: [
    sourceConfig,
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        "no-restricted-syntax": ["error", ...expoRestrictedSyntax],
      },
    },
  ],
  overrideConfigFile: true,
});

const roleEslint = new ESLint({
  cwd: appRoot,
  ignore: false,
  overrideConfig: [sourceConfig, createExpoFeatureKitConfig({ cwd: appRoot })],
  overrideConfigFile: true,
});

const expoConfig = createExpoConfig({ cwd: appRoot });
const expoReactConfig = expoConfig.find((config) =>
  config.files?.includes("src/**/*.tsx"),
);
assert.ok(expoReactConfig);
const expoPlugins = Object.assign(
  {},
  ...expoConfig.map((config) => config.plugins ?? {}),
);

const reactDocumentationEslint = new ESLint({
  ignore: false,
  overrideConfig: [
    sourceConfig,
    {
      plugins: expoPlugins,
      rules: expoReactConfig.rules,
    },
  ],
  overrideConfigFile: true,
});

const lintRestrictedSyntax = async (
  source,
  filePath = "src/features/feed/components/Feed.tsx",
) => {
  const [result] = await restrictedSyntaxEslint.lintText(source, { filePath });

  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
};

const assertRejected = async (source, expectedMessage, filePath) => {
  const messages = await lintRestrictedSyntax(source, filePath);

  assert.equal(messages.length, 1);
  assert.match(messages[0].message, expectedMessage);
};

// eslint-disable-next-line db21-tests/require-justification -- JSX null ternaries must be rejected so conditional native rendering uses the established boolean-and convention.
test("requires boolean-and rendering instead of JSX null ternaries", async () => {
  await assertRejected(
    "const value = <>{visible ? <View /> : null}</>;",
    /Use condition && <Component \/> rendering/u,
  );

  const messages = await lintRestrictedSyntax(
    "const value = <>{visible && <View />}</>;",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Visible JSX text and accessibility labels must require translation so localized Expo screens do not ship hardcoded copy.
test("rejects representative hardcoded user-facing JSX strings", async () => {
  const cases = [
    "const value = <Text>Hello</Text>;",
    'const value = <Text accessibilityLabel="Hello" />;',
    'const value = <Text>{"Hello"}</Text>;',
    "const value = <Text>{`Hello ${name}`}</Text>;",
  ];

  for (const source of cases) {
    await assertRejected(source, /i18n translation|i18n translations/u);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- JSX space expressions must be rejected because layout spacing belongs in styling rather than text-node artifacts.
test("rejects JSX space expressions", async () => {
  await assertRejected(
    'const value = <Text>{" "}</Text>;',
    /Do not use JSX space expressions/u,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Expo query types must use Maybe so mobile API boundaries do not reintroduce raw null unions.
test("requires Maybe for explicit null unions", async () => {
  await assertRejected(
    "type Value = string | null;",
    /Use Maybe<T> from @db21\/toolkit\/utils/u,
    "src/features/feed/queries/feed-products.query.ts",
  );

  const messages = await lintRestrictedSyntax(
    "type Value = Maybe<string>;",
    "src/features/feed/queries/feed-products.query.ts",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- NativeWind must remain the default while an in-place disable preserves the narrow runtime-style escape hatch.
test("requires NativeWind unless a style prop has an in-place exception", async () => {
  await assertRejected(
    "const value = <View style={frameStyle} />;",
    /Prefer NativeWind className tokens/u,
  );

  const messages = await lintRestrictedSyntax(`const value = (
    <View
      // eslint-disable-next-line no-restricted-syntax -- Runtime dimensions require a React Native style.
      style={frameStyle}
    />
  );`);

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Feature indexes must not re-export generated GraphQL documents, preserving generated artifacts as feature-private implementation details.
test("keeps generated GraphQL artifacts feature-private", async () => {
  await assertRejected(
    'export { FeedProductsDocument } from "../generated/graphql";',
    /Generated GraphQL artifacts are feature-private/u,
    "src/features/feed/index.ts",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Component and provider paths must obey feature-kit roles so misplaced Expo files do not evade architecture conventions.
test("enforces Expo component and provider file roles", async () => {
  const paths = [
    "src/features/feed/components/lint-helper.ts",
    "src/modules/i18n/providers/lint-provider.ts",
  ];

  for (const filePath of paths) {
    const [result] = await roleEslint.lintText("export const value = 1;\n", {
      filePath,
    });

    const messages = result.messages.filter(
      (message) => message.ruleId === "feature-kit-core/module-conventions",
    );

    assert.equal(messages.length, 1);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Expo TSX must inherit React documentation requirements so exported screens do not lose public API descriptions.
test("applies full React documentation rules to Expo TSX", async () => {
  const [result] = await reactDocumentationEslint.lintText(
    "export const Undocumented = (): null => null;",
    { filePath: "src/features/feed/components/Feed.tsx" },
  );

  assert.equal(
    result.messages.some((message) => message.ruleId === "jsdoc/require-jsdoc"),
    true,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Custom source roots, module roots, GraphQL directories, roles, and utility exemptions must remain configurable for nonstandard app layouts.
test("configures Expo and Nest roots without the default source layout", () => {
  const cwd = mkdtempSync(resolve(tmpdir(), "toolkit-layout-"));
  try {
    mkdirSync(resolve(cwd, "lib/domains/catalog"), { recursive: true });
    writeFileSync(
      resolve(cwd, "lib/domains/catalog/catalog.module.ts"),
      "export {};",
    );
    const layout = { cwd, sourceRoot: "lib", moduleRoots: ["lib/domains"] };
    const expoConfigs = createExpoConfig({
      ...layout,
      allowedFolders: ["services", "adapters"],
      additionalRoles: [
        {
          folder: "adapters",
          suffix: ".adapter",
          extensions: [".ts"],
          case: "kebab",
        },
      ],
      graphql: {
        graphqlDirectory: "documents",
        documentExtensions: ["graphql"],
      },
    });
    const graphqlConfig = expoConfigs.find((config) => config.processor);
    const processor =
      graphqlConfig.plugins["feature-graphql"].processors.conventions;

    const filePath = resolve(
      cwd,
      "lib/domains/catalog/documents/queries/items.query.graphql",
    );
    processor.preprocess("query Items { items { id } }", filePath);
    assert.deepEqual(processor.postprocess([], filePath), []);
    assert.deepEqual(graphqlConfig.files, ["lib/**/*.{gql,graphql}"]);
    assert.equal(
      expoConfigs.some((config) => config.files?.includes("lib/**/*.tsx")),
      true,
    );

    const nestConfigs = createNestConfig({
      ...layout,
      utilityExemptPaths: ["lib/shared"],
    });
    assert.deepEqual(nestConfigs.at(-1).files, [
      "lib/domains/**/*.{ts,tsx,mts,cts}",
    ]);
    assert.deepEqual(
      nestConfigs.at(-2).rules["db21-utilities/require-extracted-utilities"],
      ["error", { exemptPaths: ["lib/shared"] }],
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
