import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import nodePlop, { type ActionType } from "node-plop";

import { assert, isEmpty } from "../utils/index.js";
import {
  type BootstrapOptions,
  resolveBootstrapOptions,
} from "./bootstrap-options.js";
import {
  createAppManifest,
  createRootManifest,
  getAppDirectory,
} from "./workspace-manifest.js";

// The build preserves this path relative to dist/cli/bootstrap.js.
const templateRoot = fileURLToPath(
  new URL("../../templates/", import.meta.url),
);
const manifestIndentation = 2;

const createTemplateAction = (
  template: string,
  destination: string,
): ActionType => {
  const base = join(templateRoot, template);

  return {
    type: "addMany",
    destination,
    base,
    templateFiles: join(base, "**/*.hbs"),
    globOptions: { dot: true },
    stripExtensions: ["hbs"],
    abortOnFail: true,
  };
};

const copyExclusive = async (
  source: string,
  destination: string,
): Promise<void> => {
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const target = join(destination, entry.name);
    const origin = join(source, entry.name);

    if (entry.isDirectory()) {
      await mkdir(target);
      await copyExclusive(origin, target);
    } else {
      await copyFile(origin, target, constants.COPYFILE_EXCL);
    }
  }
};

const reserveDestination = async (directory: string): Promise<void> => {
  try {
    await mkdir(directory);
  } catch (error) {
    assert.true(
      error instanceof Error && "code" in error && error.code === "EEXIST",
      error instanceof Error ? error : "Cannot create destination.",
    );

    const status = await lstat(directory);

    assert.true(
      status.isDirectory() && !status.isSymbolicLink(),
      "Destination must be a directory, not a file or symbolic link.",
    );

    const entries = await readdir(directory);

    assert.true(
      isEmpty(entries),
      "Destination must be empty. No files were changed.",
    );
  }
};

export const bootstrap = async (
  options: BootstrapOptions,
  toolkitVersion: string,
): Promise<string> => {
  const { directory, projectName, apps } = resolveBootstrapOptions(options);
  const staging = await mkdtemp(join(tmpdir(), "db21-bootstrap-"));

  try {
    const plop = await nodePlop(undefined, {
      destBasePath: staging,
      force: false,
    });
    const rootManifest = createRootManifest(projectName, apps, toolkitVersion);
    const actions: ActionType[] = [createTemplateAction("base", ".")];

    for (const app of apps) {
      const appDirectory = getAppDirectory(app);

      actions.push(
        createTemplateAction(
          app.startsWith("astro") ? "astro" : app,
          `apps/${appDirectory}`,
        ),
      );
      actions.push({
        type: "add",
        path: `apps/${appDirectory}/package.json`,
        template:
          JSON.stringify(
            createAppManifest(app, projectName, toolkitVersion),
            null,
            manifestIndentation,
          ) + "\n",
      });

      if (app.startsWith("astro")) {
        actions.push(createTemplateAction(app, `apps/${appDirectory}`));
      }
    }

    const generator = plop.setGenerator("bootstrap", { prompts: [], actions });
    const result = await generator.runActions({
      projectName,
      rootManifest: JSON.stringify(rootManifest, null, manifestIndentation),
      hasAstro: apps.some((app) => app.startsWith("astro")),
      hasApi: apps.includes("api"),
      hasExpo: apps.includes("expo"),
      hasStatic: apps.includes("astro-static"),
      hasSsr: apps.includes("astro-ssr"),
      apps: apps.map((app) => ({ directory: getAppDirectory(app) })),
    });

    assert.true(
      isEmpty(result.failures),
      result.failures.map((failure) => failure.message).join("\n"),
    );
    await reserveDestination(directory);
    // Exclusive copies also refuse files created concurrently after the empty check.
    // On publication failure, leave generated files for inspection; never delete user data.
    await copyExclusive(staging, directory);

    return directory;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
