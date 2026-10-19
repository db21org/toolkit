import { basename, extname } from "node:path";

const kebabCasePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const typescriptExtensions = new Set([".cts", ".mts", ".ts"]);

const typescriptFilenameConventionsRule = {
  meta: {
    docs: {
      description:
        "Require kebab-case segments in repository TypeScript code filenames.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      Program(node) {
        const filename = basename(context.filename);
        const extension = extname(filename);

        if (!typescriptExtensions.has(extension)) {
          return;
        }

        const stem = filename.slice(0, -extension.length);
        const segments = stem.split(".");

        if (segments.every((segment) => kebabCasePattern.test(segment))) {
          return;
        }

        context.report({
          message:
            "TypeScript code filenames must use kebab-case; dot-separated role/configuration suffixes must also be kebab-case.",
          node,
        });
      },
    };
  },
};

export const typescriptFilenameConventionsPlugin = {
  rules: {
    "typescript-filename": typescriptFilenameConventionsRule,
  },
};
