import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

export const assertDependencyCruiserGraph = async ({
  allowed,
  config,
  cwd,
  rejected,
}) => {
  writeFileSync(join(cwd, "dependency-cruiser.json"), JSON.stringify(config));

  const result = await executeFile(
    process.execPath,
    [
      join(
        process.cwd(),
        "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
      ),
      "--config",
      "dependency-cruiser.json",
      "--output-type",
      "json",
      ...allowed,
      ...rejected.map(({ file }) => file),
    ],
    { cwd },
  );

  const { modules, summary } = JSON.parse(result.stdout);

  for (const file of [...allowed, ...rejected.map((entry) => entry.file)]) {
    assert.ok(
      modules.some((module) => module.source === file),
      `Missing graph entry ${file}`,
    );
  }

  for (const file of allowed) {
    assert.deepEqual(
      summary.violations.filter((violation) => violation.from === file),
      [],
      `Expected no violations from ${file}`,
    );
  }

  for (const { file, rule } of rejected) {
    assert.ok(
      summary.violations.some(
        (violation) =>
          violation.from === file && rule.test(violation.rule.name),
      ),
      `Expected ${file} to violate ${rule}; received ${JSON.stringify(summary.violations)}`,
    );
  }
};
