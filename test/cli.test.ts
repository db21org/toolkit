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
const appCombinationCount = 15;

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
  // eslint-disable-next-line db21-tests/require-justification -- Risk: project names inject template content or invalid package identifiers; Contract: malformed names fail option validation before workspace generation.
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

  // eslint-disable-next-line db21-tests/require-justification -- Risk: invalid selections generate incomplete or unintended applications; Contract: empty and unknown app selections fail with actionable validation errors.
  it("rejects missing and unknown selections", () => {
    expect(() =>
      resolveBootstrapOptions({ directory: "starter", apps: [] }),
    ).toThrow("Select at least one");
    expect(() =>
      resolveBootstrapOptions({ directory: "starter", apps: ["other"] }),
    ).toThrow("Unknown app type");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: duplicate selections publish conflicting workspace files; Contract: selection normalization deduplicates apps into the documented deterministic order.
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
  const combinations = Array.from({ length: appCombinationCount }, (_, index) =>
    appTypes.filter((_, bit) => ((index + 1) & (1 << bit)) !== 0),
  );

  // eslint-disable-next-line db21-tests/require-justification -- Risk: a supported app combination omits required files or adds unwanted frameworks; Contract: all 15 subsets generate only selected workspaces with conditional compatibility settings and no placeholder tests.
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
      const includesAstroApp = apps.some((app) => app.startsWith("astro"));

      expect(entries.toSorted((a, b) => a.localeCompare(b))).toEqual(
        expected.toSorted((a, b) => a.localeCompare(b)),
      );
      expect(root.name).toBe("starter");
      expect(root.devDependencies).toMatchObject({ "@db21/toolkit": "1.2.3" });
      expect(root.resolutions).toEqual(
        includesAstroApp
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
  // eslint-disable-next-line db21-tests/require-justification -- Risk: valid empty destinations become unusable because their directory names are not package identifiers; Contract: an explicit valid name controls the generated manifest without renaming the destination.
  it("accepts an existing empty directory and explicit name", async () => {
    const directory = join(temporaryDirectory, "directory-with-dots.local");

    await mkdir(directory);
    await bootstrap({ directory, name: "my-project", apps: ["api"] }, "1.2.3");

    const manifest = await readJson(join(directory, "package.json"));

    expect(manifest.name).toBe("my-project");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: bootstrapping destroys existing user work; Contract: refusing a nonempty destination preserves both its file list and original file contents.
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

  // eslint-disable-next-line db21-tests/require-justification -- Risk: publication follows a destination symlink into unrelated user data; Contract: file and symlink destinations are rejected and the linked directory remains empty.
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

  // eslint-disable-next-line db21-tests/require-justification -- Risk: CI bootstrap jobs hang waiting for unavailable terminal input; Contract: the built executable fails noninteractive invocations missing required flags instead of prompting.
  it("fails non-interactively instead of opening prompts", () => {
    const result = spawnSync(process.execPath, [entry, "bootstrap"], {
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Non-interactive usage requires");
  });

  // eslint-disable-next-line db21-tests/require-justification -- Risk: CLI argument wiring creates unwanted apps or silently installs dependencies and initializes Git; Contract: flagged execution generates exactly the requested apps without node_modules or a Git repository.
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
