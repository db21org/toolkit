import nodeAssert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  collectUnmappedCustomScalars,
  describeGraphqlFile,
  FEATURE_GRAPHQL_SCALAR_MAPPINGS,
  findGraphqlFiles,
  validateGraphqlFile,
} from "@db21/toolkit/eslint/expo/graphql-conventions";
import { assert, isEmpty, isNotEmpty } from "@db21/toolkit/utils";
import { test } from "vitest";

const withTempPath = () => {
  const tmp = mkdtempSync(resolve(tmpdir(), "db21-graphql-test-"));
  const base = resolve(tmp, "app");

  return {
    base,
    resolvePath: (parts) => resolve(base, parts),
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: generated artifacts receive an owner for malformed GraphQL paths; Contract: a valid feature path describes its owner while a near-miss has none.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: owner path casing drifts across case-sensitive artifact consumers; Contract: a non-kebab owner segment receives a path diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: discovered but unsupported document extensions bypass GraphQL conventions; Contract: a .graphql candidate is found but validation reports its invalid role.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: generated query artifacts encode a mutation under the wrong role; Contract: a mutation in a .query.gql file reports a role mismatch.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: document paths misrepresent operation kind to consumers; Contract: conflicting folder and suffix roles report a diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: schema definitions enter generated client operation inputs; Contract: SDL in a query document reports the operation-only diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: unsupported GraphQL filenames silently escape ownership checks; Contract: an unrecognized role path reports a location diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: module-owned operations generate metadata inconsistent with feature-owned operations; Contract: a module mutation receives its complete descriptor.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: generated clients receive anonymous operations without stable identifiers; Contract: an anonymous query reports the naming diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: unmapped schema scalars silently produce incompatible generated TypeScript; Contract: only declared preset scalar mappings suppress missing-scalar results.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: nonstandard consumer GraphQL layouts lose ownership validation or accept near-miss paths; Contract: configured roots validate the exact document path and reject an adjacent root.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: replacement scalar mappings silently retain preset entries and conceal schema gaps; Contract: replacement mappings report every omitted scalar.
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
