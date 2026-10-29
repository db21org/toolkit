import { existsSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";

import { assert, isEmpty, isNotDefined, isNotEmpty } from "@db21/toolkit/utils";

import {
  discoverModules,
  toPosixPath,
} from "#feature-kit-config/module-discovery";

const coreRoles = Object.freeze([
  Object.freeze({
    case: "kebab",
    extensions: Object.freeze([".ts"]),
    folder: "services",
    recursive: false,
    suffix: ".service",
  }),
]);

const kebabCasePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const pascalCasePattern = /^[A-Z][A-Za-z0-9]*$/;

const validateRoles = (roles) => {
  const folders = new Set();

  for (const role of roles) {
    assert.false(
      folders.has(role.folder),
      new Error(
        `Feature Kit role folder "${role.folder}" is configured more than once.`,
      ),
    );

    assert.true(
      kebabCasePattern.test(role.folder),
      new Error(
        `Feature Kit role folder "${role.folder}" must be one kebab-case path segment.`,
      ),
    );

    folders.add(role.folder);
  }
};

const stripKnownExtension = (fileName) => {
  const extension = extname(fileName);

  return {
    extension,
    stem: fileName.slice(0, -extension.length),
  };
};

const findOwningModule = (filePath, modules) =>
  modules.find(
    (module) =>
      filePath === module.directory ||
      filePath.startsWith(`${module.directory}/`),
  );

const matchesCase = (value, namingCase) =>
  namingCase === "pascal"
    ? pascalCasePattern.test(value)
    : kebabCasePattern.test(value);

const validateRoleFile = ({ context, filePath, module, roles }) => {
  const relativePath = toPosixPath(relative(module.directory, filePath));
  const segments = relativePath.split("/");
  const fileName = segments.at(-1);

  if (isNotDefined(fileName) || fileName === "index.ts") {
    return;
  }

  const role = roles.find((candidate) => {
    if (
      segments[0] === candidate.folder &&
      (candidate.recursive === true || segments.length === 2)
    ) {
      return true;
    }

    if (isEmpty(candidate.suffix)) {
      return false;
    }

    return candidate.extensions.some((extension) =>
      fileName.endsWith(`${candidate.suffix}${extension}`),
    );
  });

  if (isNotDefined(role)) {
    return;
  }

  const { extension, stem } = stripKnownExtension(fileName);
  const expectedSuffix = role.suffix;
  const hasSuffix = isEmpty(expectedSuffix) || stem.endsWith(expectedSuffix);
  const name =
    isNotEmpty(expectedSuffix) && hasSuffix
      ? stem.slice(0, -expectedSuffix.length)
      : stem;
  const inRoleFolder = segments[0] === role.folder;
  const hasExtension = role.extensions.includes(extension);

  if (inRoleFolder && hasSuffix && hasExtension) {
    if (matchesCase(name, role.case)) {
      return;
    }
  }

  const extensionList = role.extensions.join(" or ");

  context.report({
    loc: { column: 0, line: 1 },
    message: `Files for role "${role.folder}" must live under ${role.folder}/ and use ${role.case}-case names ending in ${expectedSuffix}${extensionList}.`,
  });
};

const validateModuleFolder = ({
  allowedFolders,
  context,
  filePath,
  module,
  node,
}) => {
  if (isNotDefined(allowedFolders)) {
    return;
  }

  const relativePath = toPosixPath(relative(module.directory, filePath));
  const segments = relativePath.split("/");
  const folder = segments[0];

  if (segments.length > 1 && !allowedFolders.includes(folder)) {
    context.report({
      node,
      message: `Module folders must be one of: ${allowedFolders.join(", ")}. Found "${folder}".`,
    });
  }
};

const validateModuleFile = ({ context, cwd, filePath, module, node }) => {
  const moduleFolderName = basename(module.directory);
  const expectedModuleFile = `${moduleFolderName}.module.ts`;

  if (filePath !== `${module.directory}/${module.moduleFile}`) {
    return;
  }

  if (module.moduleFile !== expectedModuleFile) {
    context.report({
      node,
      message: `Module file must be named "${expectedModuleFile}" to match its folder.`,
    });
  }

  if (!kebabCasePattern.test(moduleFolderName)) {
    context.report({
      node,
      message: "Feature Kit module folders must use kebab-case names.",
    });
  }

  if (!existsSync(resolve(cwd, module.directory, "index.ts"))) {
    context.report({
      node,
      message:
        "Feature Kit modules must expose an explicit index.ts public API.",
    });
  }
};

const validatePublicIndex = ({ context, filePath, module, node }) => {
  if (filePath !== `${module.directory}/index.ts`) {
    return;
  }

  const expectedModuleSource = `./${module.moduleFile.replace(/\.ts$/u, "")}`;
  let exportsModule = false;

  for (const statement of node.body) {
    if (statement.type === "ExportAllDeclaration") {
      context.report({
        node: statement,
        message:
          "Module public APIs must use explicit named exports instead of export *.",
      });
    }

    if (
      statement.type !== "ExportNamedDeclaration" ||
      isNotDefined(statement.source)
    ) {
      continue;
    }

    if (
      statement.source.value.replace(/\.(?:js|ts)$/u, "") ===
      expectedModuleSource
    ) {
      exportsModule = true;
    }
  }

  if (!exportsModule) {
    context.report({
      node,
      message: `Module public API must explicitly export its module from "${expectedModuleSource}.js".`,
    });
  }
};

const moduleConventionsRule = {
  meta: {
    docs: {
      description:
        "Enforce recommended Feature Kit module roots, public barrels, and role filenames.",
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allowedFolders: {
            items: { type: "string" },
            minItems: 1,
            type: "array",
            uniqueItems: true,
          },
          additionalRoles: {
            items: {
              additionalProperties: false,
              properties: {
                case: { enum: ["kebab", "pascal"] },
                extensions: {
                  items: { pattern: "^\\.", type: "string" },
                  minItems: 1,
                  type: "array",
                },
                folder: { type: "string" },
                recursive: { type: "boolean" },
                suffix: { type: "string" },
              },
              required: ["case", "extensions", "folder", "suffix"],
              type: "object",
            },
            type: "array",
          },
          cwd: { type: "string" },
          moduleRoots: {
            items: { type: "string" },
            minItems: 1,
            type: "array",
          },
        },
        required: ["moduleRoots"],
        type: "object",
      },
    ],
    type: "problem",
  },
  create(context) {
    const options = context.options[0] ?? {};
    const cwd = options.cwd ?? context.cwd ?? process.cwd();
    const modules = discoverModules({ cwd, moduleRoots: options.moduleRoots });
    const absoluteFilePath = resolve(context.filename);
    const filePath = toPosixPath(relative(cwd, absoluteFilePath));
    const module = findOwningModule(filePath, modules);
    const roles = [...coreRoles, ...(options.additionalRoles ?? [])];

    return {
      Program(node) {
        if (isNotDefined(module)) {
          return;
        }

        validateModuleFile({
          context,
          cwd,
          filePath,
          module,
          node,
        });

        validatePublicIndex({
          context,
          filePath,
          module,
          node,
        });

        validateModuleFolder({
          allowedFolders: options.allowedFolders,
          context,
          filePath,
          module,
          node,
        });
        validateRoleFile({ context, filePath, module, roles });
      },
    };
  },
};

export const featureKitCoreEslintPlugin = {
  rules: {
    "module-conventions": moduleConventionsRule,
  },
};

export const createCoreEslintConfig = ({
  additionalRoles = [],
  allowedFolders,
  cwd,
  moduleRoots,
}) => {
  assert.false(
    isEmpty(moduleRoots),
    new Error("Feature Kit ESLint config requires at least one module root."),
  );

  validateRoles([...coreRoles, ...additionalRoles]);

  return {
    files: moduleRoots.map((root) => `${root}/**/*.{ts,tsx,mts,cts}`),
    name: "feature-kit/core/recommended",
    plugins: {
      "feature-kit-core": featureKitCoreEslintPlugin,
    },
    rules: {
      "feature-kit-core/module-conventions": [
        "error",
        { additionalRoles, allowedFolders, cwd, moduleRoots },
      ],
    },
  };
};

export const coreRoleConventions = coreRoles;
