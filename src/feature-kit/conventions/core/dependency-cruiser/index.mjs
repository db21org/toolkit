import { assert, isNotDefined } from "@db21/toolkit/utils";

import {
  discoverModules,
  normalizeProjectPath,
} from "#feature-kit-config/module-discovery";

const escapeRegularExpression = (value) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pathPrefix = (value) => `^${escapeRegularExpression(value)}/`;
const indexPath = (value) =>
  `^${escapeRegularExpression(value)}/index\\.(?:ts|tsx)$`;

const sharedForbiddenRules = [
  {
    name: "feature-kit-no-circular",
    comment: "Circular dependencies obscure module ownership.",
    severity: "error",
    from: {},
    to: { circular: true },
  },
  {
    name: "feature-kit-not-to-unresolvable",
    comment: "Every import must resolve.",
    severity: "error",
    from: {},
    to: { couldNotResolve: true },
  },
  {
    name: "feature-kit-no-non-package-json",
    comment: "Runtime packages must be declared by the consuming workspace.",
    severity: "error",
    from: {},
    to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
  },
];

const createModuleRules = ({ allow, modules, sourceRoot }) => {
  const sourcePath = pathPrefix(sourceRoot);
  const moduleIndexes = modules.map((module) => indexPath(module.directory));
  const allowedPaths = allow.map(pathPrefix);

  return modules.flatMap((module) => {
    const modulePath = pathPrefix(module.directory);
    const ruleName = module.directory.replaceAll(/[^a-zA-Z0-9]+/g, "-");

    return [
      {
        name: `feature-kit-${ruleName}-imports-owned-public-or-allowed`,
        comment:
          "A module may import its own files, another module public API, configured shared code, or external packages.",
        severity: "error",
        from: { path: modulePath },
        to: {
          path: sourcePath,
          pathNot: [modulePath, ...moduleIndexes, ...allowedPaths],
        },
      },
      {
        name: `feature-kit-${ruleName}-has-public-api`,
        comment:
          "Consumers outside a module must import its explicit index.ts public API.",
        severity: "error",
        from: { path: sourcePath, pathNot: modulePath },
        to: {
          path: modulePath,
          pathNot: indexPath(module.directory),
        },
      },
    ];
  });
};

const assertModulesInsideSourceRoot = (modules, sourceRoot) => {
  const outsideModule = modules.find(
    (module) =>
      module.directory !== sourceRoot &&
      !module.directory.startsWith(`${sourceRoot}/`),
  );

  assert.notDefined(
    outsideModule,
    new Error(
      `Feature Kit module "${outsideModule?.directory}" is outside sourceRoot "${sourceRoot}".`,
    ),
  );
};

const assertAllowListIsShared = (allow, modules) => {
  for (const allowedPath of allow) {
    const overlappingModule = modules.find((module) => {
      if (allowedPath === module.directory) {
        return true;
      }

      return (
        allowedPath.startsWith(`${module.directory}/`) ||
        module.directory.startsWith(`${allowedPath}/`)
      );
    });

    assert.notDefined(
      overlappingModule,
      new Error(
        `Allow-list path "${allowedPath}" overlaps Feature Kit module "${overlappingModule?.directory}". Allow only independent shared folders.`,
      ),
    );
  }
};

const createAllowedFolderRules = ({ allow, modules }) =>
  allow.flatMap((allowedPath) =>
    modules.map((module) => ({
      name: `feature-kit-${allowedPath.replaceAll(/[^a-zA-Z0-9]+/g, "-")}-stays-module-agnostic`,
      comment:
        "Allow-listed shared code is a one-way dependency and cannot import product modules.",
      severity: "error",
      from: { path: pathPrefix(allowedPath) },
      to: { path: pathPrefix(module.directory) },
    })),
  );

const enhancedResolveOptions = {
  conditionNames: ["types", "import", "require", "default"],
  exportsFields: ["exports"],
  extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
  mainFields: ["types", "typings", "module", "main"],
};

const doNotFollow = {
  path: "node_modules",
  dependencyTypes: [
    "npm",
    "npm-dev",
    "npm-optional",
    "npm-peer",
    "npm-bundled",
    "npm-no-pkg",
  ],
};

export const createCoreDependencyCruiserConfig = ({
  allow = [],
  cwd = process.cwd(),
  exclude = [],
  moduleRoots,
  sourceRoot,
  tsConfig,
}) => {
  const modules = discoverModules({ cwd, moduleRoots });
  const normalizedAllow = allow.map((path) => normalizeProjectPath(cwd, path));
  const normalizedSourceRoot = normalizeProjectPath(cwd, sourceRoot);

  assertModulesInsideSourceRoot(modules, normalizedSourceRoot);
  assertAllowListIsShared(normalizedAllow, modules);

  return {
    forbidden: [
      ...sharedForbiddenRules,
      ...createModuleRules({
        allow: normalizedAllow,
        modules,
        sourceRoot: normalizedSourceRoot,
      }),
      ...createAllowedFolderRules({ allow: normalizedAllow, modules }),
    ],
    options: {
      doNotFollow,
      enhancedResolveOptions,
      exclude,
      ...(isNotDefined(tsConfig)
        ? {}
        : {
            tsConfig: { fileName: tsConfig },
            tsPreCompilationDeps: "specify",
          }),
    },
  };
};

export const coreDependencyCruiserRules = Object.freeze(sharedForbiddenRules);
export { discoverModules as discoverFeatureKitModules } from "#feature-kit-config/module-discovery";
