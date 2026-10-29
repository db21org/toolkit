import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { assert, isDefined, isEmpty } from "@db21/toolkit/utils";

const discoveryCache = new Map();
const ignoredDirectories = new Set([".git", ".yarn", "dist", "node_modules"]);

export const toPosixPath = (value) => value.split(sep).join("/");

export const normalizeProjectPath = (cwd, value) =>
  toPosixPath(relative(cwd, resolve(cwd, value)));

const scanDirectory = (cwd, directory, modules) => {
  const absoluteDirectory = resolve(cwd, directory);
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
  const moduleFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.ts"))
    .map((entry) => entry.name);

  assert.false(
    moduleFiles.length > 1,
    new Error(
      `Feature Kit module directory "${directory}" contains multiple *.module.ts files.`,
    ),
  );

  if (moduleFiles.length === 1) {
    const [moduleFile] = moduleFiles;

    modules.push({
      directory: normalizeProjectPath(cwd, absoluteDirectory),
      moduleFile,
    });
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      scanDirectory(cwd, resolve(absoluteDirectory, entry.name), modules);
    }
  }
};

const assertNoNestedModules = (modules) => {
  for (const parent of modules) {
    const nested = modules.find(
      (candidate) =>
        candidate !== parent &&
        candidate.directory.startsWith(`${parent.directory}/`),
    );

    assert.notDefined(
      nested,
      new Error(
        `Feature Kit module "${parent.directory}" contains nested module "${nested?.directory}". Keep recommended module boundaries as independent sibling trees.`,
      ),
    );
  }
};

export const discoverModules = ({ cwd = process.cwd(), moduleRoots }) => {
  assert.false(
    isEmpty(moduleRoots),
    new Error("Feature Kit module discovery requires at least one root."),
  );

  const normalizedCwd = resolve(cwd);
  const normalizedRoots = moduleRoots.map((root) =>
    normalizeProjectPath(normalizedCwd, root),
  );
  const cacheKey = `${normalizedCwd}\0${normalizedRoots.join("\0")}`;
  const cached = discoveryCache.get(cacheKey);

  if (isDefined(cached)) {
    return cached;
  }

  const modules = [];

  for (const root of normalizedRoots) {
    scanDirectory(normalizedCwd, root, modules);
  }

  const deduplicatedModules = [
    ...new Map(modules.map((module) => [module.directory, module])).values(),
  ];

  const uniqueModules = deduplicatedModules.toSorted((left, right) =>
    left.directory.localeCompare(right.directory),
  );

  assertNoNestedModules(uniqueModules);
  const result = Object.freeze(
    uniqueModules.map((module) => Object.freeze(module)),
  );

  discoveryCache.set(cacheKey, result);

  return result;
};

export const clearModuleDiscoveryCache = () => {
  discoveryCache.clear();
};
