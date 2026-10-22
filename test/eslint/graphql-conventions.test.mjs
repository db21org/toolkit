import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import nodeAssert from "node:assert/strict";

import { assert, isNotEmpty, isEmpty } from "@db21/toolkit/utils";
import { test } from "vitest";

import {
  FEATURE_GRAPHQL_SCALAR_MAPPINGS,
  collectUnmappedCustomScalars,
  describeGraphqlFile,
  findGraphqlFiles,
  validateGraphqlFile,
} from "@db21/toolkit/eslint/expo/graphql-conventions";

const withTempPath = () => {
  const tmp = mkdtempSync(resolve(tmpdir(), "db21-graphql-test-"));
  const base = resolve(tmp, "app");

  return {
    base,
    resolvePath: (parts) => resolve(base, parts),
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
};

// eslint-disable-next-line db21-tests/require-justification -- Feature query paths must produce the descriptor consumed by generated GraphQL artifacts; malformed paths must not acquire an owner.
test("accepts valid feature path and role", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const filePath = resolvePath(
      "src/features/feed/graphql/queries/list-items.query.gql",
    );

    nodeAssert.deepEqual(describeGraphqlFile(base, filePath), {
      owner: "feed",
      ownerKey: "features/feed",
      ownerRoot: "features",
      name: "list-items",
      projectPath: "src/features/feed/graphql/queries/list-items.query.gql",
      role: "query",
      folderRole: "queries",
    });

    assert.notDefined(
      describeGraphqlFile(
        base,
        resolvePath("src/features/feed/graphql/list-items.query.gql"),
      ),
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Owner folders must remain kebab-case so GraphQL artifact locations are stable across case-sensitive filesystems.
test("requires a canonical kebab-case feature segment", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath(
        "src/features/FeedProducts/graphql/queries/list-items.query.gql",
      ),
      source: "query ListItems { feedProducts { id } }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(issues[0].line, 1);
    nodeAssert.equal(issues[0].column, 1);
    nodeAssert.equal(
      issues[0].message.includes("src/{features,modules}/<owner>/graphql"),
      true,
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Discovery may find a candidate extension, but validation must reject extensions absent from the configured document contract.
test("findGraphqlFiles accepts .graphql but validation rejects it", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const filePath = resolvePath(
      "src/features/feed/graphql/queries/list-items.query.graphql",
    );

    mkdirSync(resolvePath("src/features/feed/graphql/queries"), {
      recursive: true,
    });
    writeFileSync(filePath, "query ListItems { feed { id } }");

    const [locatedPath] = findGraphqlFiles(base);
    nodeAssert.equal(locatedPath, filePath);

    const issues = validateGraphqlFile({
      appRoot: base,
      filePath,
      source: "query ListItems { feed { id } }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(issues[0].line, 1);
    nodeAssert.equal(issues[0].column, 1);
    nodeAssert.equal(
      issues[0].message.includes("src/{features,modules}/<owner>/graphql"),
      true,
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- A query filename must not hide a mutation because generated operation artifacts depend on the declared role.
test("flags operation role mismatches", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath(
        "src/features/feed/graphql/queries/get-feed.query.gql",
      ),
      source: "mutation GetFeed { updateFeed { id } }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(
      issues[0].message,
      "A .query.gql file may contain only query definitions.",
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Folder and suffix roles must agree so consumers can infer operation kind from a document path.
test("rejects path/suffix role mismatches", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath(
        "src/features/feed/graphql/mutations/list-items.query.gql",
      ),
      source: "query ListItems { feed { id } }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(issues[0].line, 1);
    nodeAssert.equal(issues[0].column, 1);
    nodeAssert.equal(
      issues[0].message,
      "A mutations folder contains .mutation.gql files, but this document uses .query.gql.",
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- SDL belongs to schema inputs, not feature operation documents that feed client artifact generation.
test("rejects SDL definitions in operation documents", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath(
        "src/features/feed/graphql/queries/feed-products.query.gql",
      ),
      source: "type FeedProducts { id: ID! }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(
      issues[0].message,
      "A .query.gql file may contain only query definitions.",
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Unsupported GraphQL filenames must fail with a path diagnostic instead of silently escaping feature ownership rules.
test("reports unsupported file roles", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath("src/features/feed/graphql/queries/list-items.gql"),
      source: "",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(issues[0].line, 1);
    nodeAssert.equal(issues[0].column, 1);
    nodeAssert.equal(
      issues[0].message.includes("src/{features,modules}/<owner>/graphql"),
      true,
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Module-owned operations must receive the same descriptor semantics as feature-owned operations.
test("accepts GraphQL documents owned by an application module", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const filePath = resolvePath(
      "src/modules/impressions/graphql/mutations/record-impressions.mutation.gql",
    );

    nodeAssert.deepEqual(describeGraphqlFile(base, filePath), {
      owner: "impressions",
      ownerKey: "modules/impressions",
      ownerRoot: "modules",
      name: "record-impressions",
      projectPath:
        "src/modules/impressions/graphql/mutations/record-impressions.mutation.gql",
      role: "mutation",
      folderRole: "mutations",
    });
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Anonymous operations must be rejected because generated clients require stable operation identifiers.
test("requires named operations", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const issues = validateGraphqlFile({
      appRoot: base,
      filePath: resolvePath(
        "src/features/feed/graphql/queries/get-feed.query.gql",
      ),
      source: "query { feed { id } }",
    });

    assert.true(isNotEmpty(issues));
    nodeAssert.equal(
      issues[0].message,
      "GraphQL operations must be named for generated artifacts.",
    );
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Only declared scalar mappings may suppress schema failures; the preset mapping must remain compatible with generated TypeScript types.
test("validates custom scalar mappings", () => {
  const schema = "scalar Cursor\nscalar External\n";

  nodeAssert.deepEqual(collectUnmappedCustomScalars(schema), ["External"]);
  nodeAssert.deepEqual(FEATURE_GRAPHQL_SCALAR_MAPPINGS, {
    Cursor: "string",
    DateTime: {
      input: "string",
      output: "string",
    },
    Decimal: {
      input: "@db21/toolkit/money#DecimalValue",
      output: "@db21/toolkit/money#DecimalValue",
    },
    ID: {
      input: "string",
      output: "string",
    },
  });

  const mappedSchema =
    "scalar Cursor\nscalar DateTime\nscalar Decimal\nscalar ID\n";
  assert.true(isEmpty(collectUnmappedCustomScalars(mappedSchema)));
});

// eslint-disable-next-line db21-tests/require-justification -- Consumer-provided module roots, document folders, and extensions must work together without accepting near-miss paths.
test("supports consumer document roots, directories, and extensions", () => {
  const { base, resolvePath, cleanup } = withTempPath();
  try {
    const layout = {
      moduleRoots: ["lib/domains"],
      graphqlDirectory: "api/documents",
      documentExtensions: ["graphql"],
    };

    const filePath = resolvePath(
      "lib/domains/catalog/api/documents/queries/list-items.query.graphql",
    );
    const source = "query ListItems { items { id } }";

    nodeAssert.equal(
      describeGraphqlFile(base, filePath, layout)?.owner,
      "catalog",
    );
    nodeAssert.deepEqual(
      validateGraphqlFile({ appRoot: base, filePath, source, ...layout }),
      [],
    );
    nodeAssert.equal(describeGraphqlFile(base, filePath), undefined);
    nodeAssert.equal(
      describeGraphqlFile(
        base,
        resolvePath(
          "lib/domains-other/catalog/api/documents/queries/list-items.query.graphql",
        ),
        layout,
      ),
      undefined,
    );

    mkdirSync(resolvePath("lib/domains/catalog/api/documents/queries"), {
      recursive: true,
    });
    writeFileSync(filePath, source);
    nodeAssert.deepEqual(findGraphqlFiles(base, { sourceRoot: "lib" }), [
      filePath,
    ]);
  } finally {
    cleanup();
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Replacing scalar mappings must not retain preset entries implicitly, which would conceal unmapped schema types.
test("uses replacement scalar mappings without implicit preset mappings", () => {
  const schema = "scalar Cursor\nscalar External\nscalar toString\n";

  nodeAssert.deepEqual(
    collectUnmappedCustomScalars(schema, { External: "string" }),
    ["Cursor", "toString"],
  );
  nodeAssert.deepEqual(collectUnmappedCustomScalars("scalar Cursor", {}), [
    "Cursor",
  ]);
  nodeAssert.deepEqual(
    collectUnmappedCustomScalars(schema, {
      ...FEATURE_GRAPHQL_SCALAR_MAPPINGS,
      External: "string",
    }),
    ["toString"],
  );
});
