import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bootstrap } from "../src/cli/bootstrap.js";
import {
  appTypes,
  resolveBootstrapOptions,
} from "../src/cli/bootstrap-options.js";

let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "toolkit-cli-test-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const readJson = async (path: string): Promise<Record<string, unknown>> => {
  const contents = await readFile(path, "utf8");

  return JSON.parse(contents) as Record<string, unknown>;
};

describe("bootstrap options", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Project names cross manifest and template boundaries; unsafe or invalid names must fail before generation.
  it.each([
    "Bad Name",
    "../escape",
    'name"injection',
    "@scope/name",
    "-name",
    "",
  ])("rejects unsafe name %s", (name) => {
    expect(() =>
      resolveBootstrapOptions({ directory: "starter", name, apps: ["api"] }),
    ).toThrow("Project name");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Invalid app selections must stop generation rather than silently create incomplete or unintended workspaces.
  it("rejects missing and unknown selections", () => {
    expect(() =>
      resolveBootstrapOptions({ directory: "starter", apps: [] }),
    ).toThrow("Select at least one");
    expect(() =>
      resolveBootstrapOptions({ directory: "starter", apps: ["other"] }),
    ).toThrow("Unknown app type");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Duplicate selections must not publish the same workspace twice or make generated output order-dependent.
  it("normalizes selection order and duplicates", () => {
    expect(
      resolveBootstrapOptions({
        directory: "starter",
        apps: ["expo", "api", "expo"],
      }).apps,
    ).toEqual(["api", "expo"]);
  });
});

describe("bootstrap generation", () => {
  const combinations = Array.from({ length: 15 }, (_, index) =>
    appTypes.filter((_, bit) => ((index + 1) & (1 << bit)) !== 0),
  );

  // eslint-disable-next-line db21-tests/require-justification -- Every supported app subset must generate only selected workspaces and conditionally include required Astro compatibility settings.
  it.each(combinations.map((apps) => ({ apps, label: apps.join(",") })))(
    "generates selected workspaces: $label",
    async ({ apps }) => {
      const directory = join(temporaryDirectory, "starter");

      await bootstrap({ directory, apps }, "1.2.3");

      const root = await readJson(join(directory, "package.json"));
      const entries = await readdir(join(directory, "apps"));
      const expected = apps.map(
        (app) =>
          ({
            api: "api",
            expo: "app",
            "astro-static": "landing",
            "astro-ssr": "site",
          })[app],
      );

      const yarnConfig = await readFile(join(directory, ".yarnrc.yml"), "utf8");
      const workflow = await readFile(
        join(directory, ".github/workflows/validate.yml"),
        "utf8",
      );

      expect(entries.toSorted((a, b) => a.localeCompare(b))).toEqual(
        expected.toSorted((a, b) => a.localeCompare(b)),
      );
      expect(root.name).toBe("starter");
      expect(root.devDependencies).toMatchObject({ "@db21/toolkit": "1.2.3" });
      expect(root.resolutions).toEqual(
        apps.some((app) => app.startsWith("astro"))
          ? { "@astrojs/language-server": "2.16.11" }
          : undefined,
      );
      expect(yarnConfig).toContain("nodeLinker: node-modules");
      expect(workflow).toContain("yarn install --immutable");
      const testConfig = await readFile(
        join(directory, "vitest.config.ts"),
        "utf8",
      );

      expect(testConfig).toContain("passWithNoTests: true");
      const rootEntries = await readdir(directory);

      expect(rootEntries).not.toContain("test");

      for (const app of expected) {
        const manifest = await readJson(
          join(directory, "apps", app, "package.json"),
        );

        expect(manifest.name).toBe(`@starter/${app}`);
        expect(manifest.scripts).toHaveProperty("build");
        expect(manifest.dependencies).not.toHaveProperty("google-auth-library");
      }
    },
  );
});

describe("bootstrap destination safety", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Explicit names must allow safe generation into an empty destination whose directory name is not a valid package name.
  it("accepts an existing empty directory and explicit name", async () => {
    const directory = join(temporaryDirectory, "directory-with-dots.local");

    await mkdir(directory);
    await bootstrap({ directory, name: "my-project", apps: ["api"] }, "1.2.3");

    const manifest = await readJson(join(directory, "package.json"));

    expect(manifest.name).toBe("my-project");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Generator must never overwrite or remove existing user files when refusing a nonempty destination.
  it("refuses nonempty directories without changing content", async () => {
    const directory = join(temporaryDirectory, "starter");

    await mkdir(directory);
    await writeFile(join(directory, ".keep"), "user work");
    await expect(
      bootstrap({ directory, apps: ["api"] }, "1.2.3"),
    ).rejects.toThrow("Destination must be empty");
    const entries = await readdir(directory);
    const contents = await readFile(join(directory, ".keep"), "utf8");

    expect(entries).toEqual([".keep"]);
    expect(contents).toBe("user work");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Files and symlink destinations must be rejected without publishing through links into unrelated directories.
  it("refuses files and symlink destinations", async () => {
    const file = join(temporaryDirectory, "file");
    const directory = join(temporaryDirectory, "directory");
    const link = join(temporaryDirectory, "link");

    await writeFile(file, "user work");
    await mkdir(directory);
    await symlink(directory, link);
    await expect(
      bootstrap({ directory: file, apps: ["api"] }, "1.2.3"),
    ).rejects.toThrow("Destination must be a directory");
    await expect(
      bootstrap({ directory: link, apps: ["api"] }, "1.2.3"),
    ).rejects.toThrow("Destination must be a directory");
    const entries = await readdir(directory);

    expect(entries).toEqual([]);
  });
});

describe("built CLI", () => {
  const entry = resolve("dist/cli/index.js");

  // eslint-disable-next-line db21-tests/require-justification -- CI invocations without required flags must fail rather than hang indefinitely on interactive prompts.
  it("fails non-interactively instead of opening prompts", () => {
    const result = spawnSync(process.execPath, [entry, "bootstrap"], {
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Non-interactive usage requires");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Built CLI must honor selected apps without implicitly installing dependencies or mutating repository state.
  it("generates with flags and no installation or Git initialization", async () => {
    const directory = join(temporaryDirectory, "cli-starter");

    execFileSync(process.execPath, [
      entry,
      "bootstrap",
      directory,
      "--apps",
      "api,astro-ssr",
    ]);

    const entries = await readdir(directory);

    expect(entries).not.toContain("node_modules");
    expect(entries).not.toContain(".git");
    const apps = await readdir(join(directory, "apps"));

    expect(apps).toEqual(["api", "site"]);
  });
});
