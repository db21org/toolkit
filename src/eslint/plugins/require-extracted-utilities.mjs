import { basename, isAbsolute, relative, resolve } from "node:path";

import { isEmpty } from "@db21/toolkit/utils";

const utilityFilenamePattern = /\.util\.(?:cts|mts|ts)$/u;
const testFilenamePattern = /\.(?:spec|test)\.(?:cts|mts|ts)$/u;

const isFunctionValue = (node) =>
  ["ArrowFunctionExpression", "FunctionExpression"].includes(node?.type);

const isExemptFile = (filename, cwd, exemptPaths) => {
  const normalizedFilename = filename.replaceAll("\\", "/");
  const name = basename(normalizedFilename);

  if (
    testFilenamePattern.test(name) ||
    name === "main.ts" ||
    name.endsWith(".module.ts")
  ) {
    return true;
  }

  return (
    exemptPaths.some((path) => {
      const fromExemption = relative(resolve(cwd, path), resolve(filename));

      if (isEmpty(fromExemption)) {
        return true;
      }

      if (isAbsolute(fromExemption) || fromExemption === "..") {
        return false;
      }

      return (
        !fromExemption.startsWith("../") && !fromExemption.startsWith("..\\")
      );
    }) ||
    (normalizedFilename.includes("/utils/") &&
      utilityFilenamePattern.test(name))
  );
};

const reportUtility = (context, node, name) => {
  context.report({
    data: { name },
    messageId: "extract",
    node,
  });
};

const requireExtractedUtilitiesRule = {
  meta: {
    docs: {
      description:
        "Require private module-scope helpers to live in explicit utility files.",
    },
    messages: {
      extract:
        'Move private module-scope helper "{{name}}" to a module-local utils/*.util.ts file, or reuse an existing module/shared utility. Search existing utilities before adding one; essential utilities require focused tests.',
    },
    schema: [
      {
        type: "object",
        properties: {
          exemptPaths: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
        additionalProperties: false,
      },
    ],
    type: "suggestion",
  },
  create(context) {
    const { exemptPaths = ["packages/utils/src"] } = context.options[0] ?? {};

    if (isExemptFile(context.filename, context.cwd, exemptPaths)) {
      return {};
    }

    return {
      "Program > FunctionDeclaration"(node) {
        if (node.id) {
          reportUtility(context, node, node.id.name);
        }
      },
      "Program > VariableDeclaration > VariableDeclarator"(node) {
        if (node.id.type === "Identifier" && isFunctionValue(node.init)) {
          reportUtility(context, node, node.id.name);
        }
      },
    };
  },
};

export const requireExtractedUtilitiesPlugin = {
  rules: {
    "require-extracted-utilities": requireExtractedUtilitiesRule,
  },
};
