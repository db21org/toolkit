import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

import { assert, isDefined, isNotDefined } from "../utils/index.js";

export const hasAgentInstructions = async (path: string): Promise<boolean> => {
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  ).catch((error: unknown) => {
    assert.true(
      error instanceof Error && "code" in error && error.code === "ENOENT",
      "Cannot safely read AGENTS.md.",
    );

    return undefined;
  });

  if (isNotDefined(file)) {
    return false;
  }

  try {
    const metadata = await file.stat();

    assert.true(metadata.isFile(), "AGENTS.md must be a regular file.");
    const contents = await file.readFile("utf8");

    return contents.includes("<!-- db21-toolkit:test-policy -->");
  } finally {
    await file.close();
  }
};

export const acquireAgentsLock = async (
  path: string,
): Promise<Awaited<ReturnType<typeof open>>> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const lock = await open(path, "wx", 0o600).catch((error: unknown) => {
      assert.true(
        error instanceof Error && "code" in error && error.code === "EEXIST",
        "Cannot acquire AGENTS.md initialization lock.",
      );

      return undefined;
    });

    if (isDefined(lock)) {
      return lock;
    }

    await setTimeout(25);
  }

  throw new Error(
    "AGENTS.md initialization is locked; retry after the other initializer exits. If it crashed, inspect and remove AGENTS.md.toolkit.lock manually.",
  );
};
