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
test("supports a consumer-owned navigation hook without changing restrictions", () => {
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
  const [, restriction] = restrictionConfig.rules["no-restricted-imports"];

  assert.deepEqual(restriction.paths[0].importNames, ["useRouter"]);
  assert.match(
    restriction.paths[0].message,
    /useNavigation from @\/navigation/u,
  );
  assert.equal(
    configs.some((config) =>
      config.files?.includes("src/navigation/use-navigation.hook.ts"),
    ),
    true,
  );
});

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
const expoGraphqlConfig = expoConfig.find((config) =>
  config.files?.includes("src/**/*.{gql,graphql}"),
);

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

test("wires GraphQL conventions into Expo source files", () => {
  assert.equal(expoGraphqlConfig?.processor, "feature-graphql/conventions");
  assert.ok(expoGraphqlConfig.plugins?.["feature-graphql"]);
});

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

test("rejects JSX space expressions", async () => {
  await assertRejected(
    'const value = <Text>{" "}</Text>;',
    /Do not use JSX space expressions/u,
  );
});

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

test("keeps generated GraphQL artifacts feature-private", async () => {
  await assertRejected(
    'export { FeedProductsDocument } from "../generated/graphql";',
    /Generated GraphQL artifacts are feature-private/u,
    "src/features/feed/index.ts",
  );
});

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
