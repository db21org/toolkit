import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  createExpoConfig,
  createExpoFeatureKitConfig,
  expoRestrictedSyntax,
} from "@db21/toolkit/eslint/expo";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import {
  createCustomLayoutEslints,
  utilitySource,
} from "./expo-layout-helpers.mjs";

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: screens bypass the app navigation boundary or cannot use its approved hook; Contract: Expo Router imports fail while the configured hook remains lint-clean.
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
  const allowed = await configuredEslint.lintText(
    'import { useNavigation } from "@/navigation";\nuseNavigation();',
    { filePath },
  );

  const restricted = await configuredEslint.lintText(
    'import { useRouter } from "expo-router";\nuseRouter();',
    { filePath },
  );

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

const lintResult = async (eslint, source, filePath) => {
  const [result] = await eslint.lintText(source, { filePath });

  return result;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: native screens diverge into unsupported conditional-rendering forms; Contract: JSX null ternaries fail and boolean-and rendering passes.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: localized mobile screens ship untranslated visible or accessible copy; Contract: representative hardcoded JSX text and labels produce lint errors.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: text-node spacing produces fragile native layouts; Contract: a JSX space expression is rejected by the Expo syntax policy.
test("rejects JSX space expressions", async () => {
  await assertRejected(
    'const value = <Text>{" "}</Text>;',
    /Do not use JSX space expressions/u,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: mobile query APIs reintroduce incompatible raw null unions; Contract: explicit null unions fail while Maybe values pass.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: ad hoc native styles bypass the shared styling system without review; Contract: style props fail unless a local justified exception suppresses them.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: generated GraphQL internals become accidental feature public APIs; Contract: index re-exports from generated artifacts are rejected.
test("keeps generated GraphQL artifacts feature-private", async () => {
  await assertRejected(
    'export { FeedProductsDocument } from "../generated/graphql";',
    /Generated GraphQL artifacts are feature-private/u,
    "src/features/feed/index.ts",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: misplaced components and providers evade feature ownership conventions; Contract: invalid Expo role paths report module-conventions errors.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: exported Expo screens lose their required public API documentation; Contract: an undocumented TSX export reports the React JSDoc rule.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: nonstandard application layouts lose role, utility, or GraphQL ownership enforcement; Contract: configured lib roots lint valid custom roles and GraphQL paths while rejecting a non-exempt utility.
test("enforces Expo and Nest conventions for a custom source layout", async () => {
  const cwd = mkdtempSync(resolve(tmpdir(), "toolkit-layout-"));

  try {
    const { expoEslint, nestEslint } = createCustomLayoutEslints(cwd);

    const adapterResult = await lintResult(
      expoEslint,
      "export const CATALOG_ADAPTER = 1;\n",
      "lib/domains/catalog/adapters/catalog.adapter.ts",
    );

    const misplacedAdapterResult = await lintResult(
      expoEslint,
      "export const CATALOG_ADAPTER = 1;\n",
      "lib/domains/catalog/misc/catalog.adapter.ts",
    );

    const graphqlResult = await lintResult(
      expoEslint,
      "query Items { items { id } }",
      "lib/domains/catalog/documents/queries/items.query.graphql",
    );

    assert.deepEqual(adapterResult.messages, []);
    const [misplacedMessage] = misplacedAdapterResult.messages;

    assert.equal(
      misplacedMessage.ruleId,
      "feature-kit-core/module-conventions",
    );
    assert.equal(
      misplacedMessage.message,
      'Files for role "adapters" must live under adapters/ and use kebab-case names ending in .adapter.ts.',
    );
    assert.deepEqual(graphqlResult.messages, []);

    const exemptResult = await lintResult(
      nestEslint,
      utilitySource,
      "lib/shared/normalize.ts",
    );

    const nonExemptResult = await lintResult(
      nestEslint,
      utilitySource,
      "lib/domains/catalog/normalize.ts",
    );

    assert.deepEqual(exemptResult.messages, []);
    assert.ok(
      nonExemptResult.messages.some(
        (message) =>
          message.ruleId === "db21-utilities/require-extracted-utilities",
      ),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
