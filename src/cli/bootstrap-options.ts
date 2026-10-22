import { basename, resolve } from "node:path";

import { assert, isNotEmpty } from "../utils/index.js";

export const appTypes = ["api", "expo", "astro-static", "astro-ssr"] as const;

export type AppType = (typeof appTypes)[number];

export type BootstrapOptions = {
  directory: string;
  name?: string;
  apps: readonly string[];
};

export const resolveBootstrapOptions = (
  options: BootstrapOptions,
): {
  directory: string;
  projectName: string;
  apps: AppType[];
} => {
  const directory = resolve(options.directory);
  const projectName = options.name ?? basename(directory);

  assert.true(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(projectName),
    "Project name must be lowercase kebab-case, starting with a letter.",
  );
  assert.true(isNotEmpty(options.apps), "Select at least one app type.");
  assert.true(
    options.apps.every((app) => appTypes.some((type) => type === app)),
    `Unknown app type. Choose: ${appTypes.join(", ")}.`,
  );

  const apps = appTypes.filter((type) => options.apps.includes(type));

  return { directory, projectName, apps };
};
