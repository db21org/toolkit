import { constants } from "node:fs";
import { open, readFile, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { assert, isNotEmpty } from "../utils/index.js";
import { acquireAgentsLock, hasAgentInstructions } from "./agents-file.js";

const ownerWritePublicReadMode = 0o644;

/**
 * Append toolkit instructions without replacing existing repository guidance.
 * @param directory - Existing target repository directory.
 * @returns Whether a new policy section was added.
 */
export const initAgents = async (directory: string): Promise<boolean> => {
  const destination = resolve(directory);
  const directoryStat = await stat(destination);

  assert.true(
    directoryStat.isDirectory(),
    "Target must be an existing directory.",
  );

  const path = join(destination, "AGENTS.md");

  const initialized = await hasAgentInstructions(path);

  if (initialized) {
    return false;
  }

  const lockPath = `${path}.toolkit.lock`;
  const lock = await acquireAgentsLock(lockPath);

  try {
    const initializedUnderLock = await hasAgentInstructions(path);

    if (initializedUnderLock) {
      return false;
    }

    const added = await appendInstructions(path);

    return added;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
};

const appendInstructions = async (path: string): Promise<boolean> => {
  const section = await readFile(
    new URL("../../templates/base/AGENTS.md.hbs", import.meta.url),
    "utf8",
  );

  const file = await open(
    path,
    constants.O_RDWR |
      constants.O_CREAT |
      constants.O_APPEND |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK,
    ownerWritePublicReadMode,
  );

  try {
    const fileStat = await file.stat();

    assert.true(fileStat.isFile(), "AGENTS.md must be a regular file.");

    const existing = await file.readFile("utf8");

    if (existing.includes("<!-- db21-toolkit:test-policy -->")) {
      return false;
    }

    let separator = "";

    if (isNotEmpty(existing)) {
      separator = existing.endsWith("\n") ? "\n" : "\n\n";
    }

    await file.appendFile(`${separator}${section}`, "utf8");

    return true;
  } finally {
    await file.close();
  }
};
