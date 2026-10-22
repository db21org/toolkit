import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

import { initAgents } from "../src/cli/agents.js";

// eslint-disable-next-line db21-tests/require-justification -- Risk: instruction initialization overwrites repository guidance or duplicates policy; Contract: built CLI creates instructions and repeated initialization preserves existing bytes.
it("creates and appends agent instructions without replacing existing guidance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "toolkit-agents-"));

  try {
    execFileSync(process.execPath, [
      resolve("dist/cli/index.js"),
      "agents",
      "init",
      directory,
    ]);

    const path = join(directory, "AGENTS.md");
    const generated = await readFile(path, "utf8");

    expect(generated).toContain(
      "node_modules/@db21/toolkit/docs/test-policy.md",
    );
    const repeatedCreation = await initAgents(directory);
    const afterCreation = await readFile(path, "utf8");

    expect(repeatedCreation).toBe(false);
    expect(afterCreation).toBe(generated);

    await writeFile(path, "# Existing instructions\nKeep user work.");
    const changed = await initAgents(directory);

    expect(changed).toBe(true);

    const appended = await readFile(path, "utf8");

    expect(appended).toBe(
      `# Existing instructions\nKeep user work.\n\n${generated}`,
    );
    const repeatedAppend = await initAgents(directory);
    const afterAppend = await readFile(path, "utf8");

    expect(repeatedAppend).toBe(false);
    expect(afterAppend).toBe(appended);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: symlinked instruction file redirects writes outside target repository; Contract: initialization refuses symlinks without altering their destination.
it("refuses a symlinked AGENTS.md without modifying its target", async () => {
  const directory = await mkdtemp(join(tmpdir(), "toolkit-agents-safety-"));

  try {
    const target = join(directory, "original.md");

    await writeFile(target, "User guidance");
    await symlink(target, join(directory, "AGENTS.md"));
    await expect(initAgents(directory)).rejects.toThrow();
    const original = await readFile(target, "utf8");

    expect(original).toBe("User guidance");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
