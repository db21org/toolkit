import { basename } from "node:path";

import { isEmpty } from "@db21/toolkit/utils";

import { createPrismaTypeCheck } from "./prisma-repository-types.mjs";

const defaultClientNames = [
  "Prisma",
  "PrismaClient",
  "PrismaService",
  "createPrismaClient",
];
const clientModules = new Set(["@prisma/client", "@prisma/client/extension"]);
const methods = new Set([
  "$connect",
  "$disconnect",
  "$extends",
  "$transaction",
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
]);
const repositoryFilename = /\.repository\.(?:[cm]?[jt]s|[jt]sx)$/u;
const message =
  "Use Prisma only inside repositories. Call a repository from this file; allow database setup/lifecycle explicitly through this rule's allow option.";

const memberName = (node) => {
  if (!node.computed) {
    return node.property.name;
  }

  if (
    node.property.type === "TemplateLiteral" &&
    isEmpty(node.property.expressions)
  ) {
    return node.property.quasis[0].value.cooked;
  }

  return node.property.value;
};

const isTypeImport = (declaration, specifier) =>
  declaration.importKind === "type" || specifier.importKind === "type";

const isTypeExport = (declaration, specifier) =>
  declaration.exportKind === "type" || specifier.exportKind === "type";

const isGlobalRequire = (node, context) => {
  if (node.callee.type !== "Identifier" || node.callee.name !== "require") {
    return false;
  }

  let scope = context.sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get("require");

    if (variable) {
      return isEmpty(variable.defs);
    }

    scope = scope.upper;
  }

  return true;
};

const checkImports = (node, names, report, isClient) => {
  for (const specifier of node.specifiers) {
    if (isTypeImport(node, specifier)) {
      continue;
    }

    const imported = specifier.imported?.name ?? specifier.imported?.value;

    if (
      names.has(imported) ||
      isClient(specifier.local) ||
      (clientModules.has(node.source.value) &&
        specifier.type !== "ImportSpecifier")
    ) {
      report(specifier);
    }
  }
};

const checkTypedReferences = (context, isClient, report) => {
  for (const scope of context.sourceCode.scopeManager.scopes) {
    for (const reference of scope.references) {
      const node = reference.identifier;

      if (
        reference.isValueReference !== false &&
        reference.isRead() &&
        isClient(node) &&
        !(
          node.parent.type === "MemberExpression" && node.parent.object === node
        )
      ) {
        report(node);
      }
    }
  }
};

const createSyntaxVisitors = (names, report, isClient, context) => ({
  ImportDeclaration: (node) => checkImports(node, names, report, isClient),
  ExportNamedDeclaration(node) {
    for (const specifier of node.specifiers) {
      if (
        !isTypeExport(node, specifier) &&
        names.has(specifier.local.name ?? specifier.local.value)
      ) {
        report(specifier);
      }
    }
  },
  ExportAllDeclaration(node) {
    if (node.exportKind !== "type" && clientModules.has(node.source.value)) {
      report(node);
    }
  },
  MemberExpression(node) {
    if (
      methods.has(memberName(node)) ||
      isClient(node.object) ||
      (isClient(node) &&
        !(
          node.parent.type === "MemberExpression" && node.parent.object === node
        ))
    ) {
      report(node);
    }
  },
  ImportExpression(node) {
    if (clientModules.has(node.source.value)) {
      report(node);
    }
  },
  Property(node) {
    if (
      node.parent.type === "ObjectPattern" &&
      methods.has(memberName({ ...node, property: node.key }))
    ) {
      report(node);
    }
  },
  TSImportEqualsDeclaration(node) {
    if (
      node.importKind !== "type" &&
      clientModules.has(node.moduleReference.expression?.value)
    ) {
      report(node);
    }
  },
  CallExpression(node) {
    if (
      isGlobalRequire(node, context) &&
      clientModules.has(node.arguments[0]?.value)
    ) {
      report(node);
    }
  },
});

const repositoryOnly = {
  meta: {
    type: "problem",
    docs: { description: "Keep Prisma access behind repository boundaries." },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          allow: { type: "boolean" },
          clientNames: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
        },
      },
    ],
    messages: { repositoryOnly: message },
  },
  create(context) {
    if (
      context.options[0]?.allow ||
      repositoryFilename.test(basename(context.filename))
    ) {
      return {};
    }

    const names = new Set([
      ...defaultClientNames,
      ...(context.options[0]?.clientNames ?? []),
    ]);
    const isClient = createPrismaTypeCheck(context);
    const reported = new Set();

    const report = (node) => {
      if (!reported.has(node)) {
        reported.add(node);
        context.report({ node, messageId: "repositoryOnly" });
      }
    };

    return {
      ...createSyntaxVisitors(names, report, isClient, context),
      "Program:exit": () => checkTypedReferences(context, isClient, report),
    };
  },
};

export const prismaRepositoryPlugin = {
  rules: { "repository-only": repositoryOnly },
};
