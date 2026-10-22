import { readdirSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";

import { isEmpty, isNotDefined } from "@db21/toolkit/utils";
import { Kind, parse } from "graphql";

const GRAPHQL_ROLE_BY_FOLDER = {
  fragments: "fragment",
  mutations: "mutation",
  queries: "query",
  subscriptions: "subscription",
};

const ownerPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const graphqlFilePattern =
  /^(queries|mutations|subscriptions|fragments)(?:\/.+)?\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.(query|mutation|subscription|fragment)\.(gql|graphql)$/u;

const toProjectPath = (appRoot, filePath) =>
  relative(appRoot, resolve(filePath)).split(sep).join("/");

export const describeGraphqlFile = (
  appRoot,
  filePath,
  {
    moduleRoots = ["src/features", "src/modules"],
    graphqlDirectory = "graphql",
    documentExtensions = ["gql"],
  } = {},
) => {
  const projectPath = toProjectPath(appRoot, filePath);

  for (const root of moduleRoots) {
    const rootPath = resolve(appRoot, root);
    const [owner] = relative(rootPath, resolve(filePath)).split(sep);

    if (isNotDefined(owner) || !ownerPattern.test(owner)) {
      continue;
    }

    const documentPath = relative(
      resolve(rootPath, owner, graphqlDirectory),
      resolve(filePath),
    )
      .split(sep)
      .join("/");
    const match = graphqlFilePattern.exec(documentPath);

    if (isNotDefined(match) || !documentExtensions.includes(match[4])) {
      continue;
    }

    const [, folderRole, name, suffixRole] = match;
    const ownerRoot = basename(rootPath);

    return {
      owner,
      ownerKey: `${ownerRoot}/${owner}`,
      ownerRoot,
      name,
      projectPath,
      role: suffixRole,
      folderRole,
    };
  }

  return undefined;
};

export const findGraphqlFiles = (appRoot, { sourceRoot = "src" } = {}) => {
  const absoluteSourceRoot = resolve(appRoot, sourceRoot);
  const files = [];

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".gql") || entry.name.endsWith(".graphql"))
      ) {
        files.push(entryPath);
      }
    }
  };

  visit(absoluteSourceRoot);

  return files.toSorted((left, right) => left.localeCompare(right));
};

const assertNamedDefinition = ({
  definition,
  descriptor,
  extension,
  issues,
}) => {
  if (
    definition.kind === Kind.OPERATION_DEFINITION &&
    isNotDefined(definition.name)
  ) {
    issues.push({
      column: definition.loc?.startToken?.column ?? 1,
      line: definition.loc?.startToken?.line ?? 1,
      message: "GraphQL operations must be named for generated artifacts.",
    });
  }

  if (definition.kind === Kind.FRAGMENT_DEFINITION) {
    if (descriptor.role !== "fragment") {
      issues.push({
        column: definition.loc?.startToken?.column ?? 1,
        line: definition.loc?.startToken?.line ?? 1,
        message: `A .${descriptor.role}${extension} file may contain only ${descriptor.role} definitions.`,
      });
    }

    return;
  }

  if (definition.kind === Kind.OPERATION_DEFINITION) {
    if (descriptor.role !== definition.operation) {
      issues.push({
        column: definition.loc?.startToken?.column ?? 1,
        line: definition.loc?.startToken?.line ?? 1,
        message: `A .${descriptor.role}${extension} file may contain only ${descriptor.role} definitions.`,
      });
    }

    return;
  }

  issues.push({
    column: definition.loc?.startToken?.column ?? 1,
    line: definition.loc?.startToken?.line ?? 1,
    message: `A .${descriptor.role}${extension} file may contain only ${descriptor.role} definitions.`,
  });
};

export const validateGraphqlFile = ({
  appRoot,
  filePath,
  source,
  ...layout
}) => {
  const descriptor = describeGraphqlFile(appRoot, filePath, layout);

  if (isNotDefined(descriptor)) {
    return [
      {
        column: 1,
        line: 1,
        message: `GraphQL documents must live in ${
          layout.moduleRoots?.join(" or ") ?? "src/{features,modules}"
        }/<owner>/${layout.graphqlDirectory ?? "graphql"}/{queries,mutations,subscriptions,fragments}, use kebab-case names, and end with a matching operation or fragment suffix and a configured extension (${(layout.documentExtensions ?? ["gql"]).join(", ")}).`,
      },
    ];
  }

  let document;

  try {
    document = parse(source);
  } catch (error) {
    const location = error.locations?.[0];

    return [
      {
        column: location?.column ?? 1,
        line: location?.line ?? 1,
        message: error.message,
      },
    ];
  }

  const issues = [];
  const extension = extname(filePath);

  if (GRAPHQL_ROLE_BY_FOLDER[descriptor.folderRole] !== descriptor.role) {
    issues.push({
      column: 1,
      line: 1,
      message: `A ${descriptor.folderRole} folder contains .${GRAPHQL_ROLE_BY_FOLDER[descriptor.folderRole]}${extension} files, but this document uses .${descriptor.role}${extension}.`,
    });
  }

  if (isEmpty(document.definitions)) {
    issues.push({
      column: 1,
      line: 1,
      message: "GraphQL documents must contain at least one definition.",
    });
  }

  for (const definition of document.definitions) {
    assertNamedDefinition({ definition, descriptor, extension, issues });
  }

  return issues;
};

export const FEATURE_GRAPHQL_SCALAR_MAPPINGS = {
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
};

const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

export const collectUnmappedCustomScalars = (
  schemaSource,
  scalarMappings = FEATURE_GRAPHQL_SCALAR_MAPPINGS,
) => {
  const schemaDocument = parse(schemaSource);
  const customScalars = schemaDocument.definitions
    .filter((definition) => definition.kind === Kind.SCALAR_TYPE_DEFINITION)
    .map((definition) => definition.name.value)
    .filter((name) => !BUILTIN_SCALARS.has(name))
    .filter((name) => !Object.hasOwn(scalarMappings, name));

  return [...new Set(customScalars)].toSorted((left, right) =>
    left.localeCompare(right),
  );
};
