import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

const cli = resolve("dist/cli/index.js");
const fixture = `export function summarize(values) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value.active && value.amount > 0) {
      total += value.amount;
      count += 1;
    }
  }
  if (count === 0) {
    return { total: 0, average: 0 };
  }
  return { total, average: total / count };
}
`;

// eslint-disable-next-line db21-tests/require-justification -- Risk: consumer configs can enable remote source uploads or turn advisory findings into failures; Contract: built CLI ignores repository jscpd settings and reports AST pairs successfully with excluded paths omitted.
it("reports advisory AST candidates without inheriting repository config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "toolkit-duplicates-"));

  try {
    await writeFile(join(directory, "first.js"), fixture);
    const renamedFixture = fixture
      .replaceAll("summarize", "aggregate")
      .replaceAll("values", "entries")
      .replaceAll("value", "entry")
      .replaceAll("total", "sum")
      .replaceAll("count", "length");

    await writeFile(join(directory, "second.js"), renamedFixture);
    await mkdir(join(directory, "generated"));
    await writeFile(join(directory, "generated/third.js"), fixture);
    await writeFile(join(directory, "excluded.js"), fixture);
    await writeFile(
      join(directory, ".jscpd.json"),
      JSON.stringify({
        threshold: 0,
        ignore: ["**/*"],
        semantic: {
          enabled: true,
          provider: "http",
          url: "http://127.0.0.1:1/v1",
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [cli, "duplicates", ".", "--reporters=json", "--ignore=,**/excluded.js,"],
      { cwd: directory, encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);

    const reportText = await readFile(
      join(directory, ".toolkit/duplicates/jscpd-report.json"),
      "utf8",
    );

    const report = JSON.parse(reportText) as {
      duplicates: {
        method: string;
        firstFile: { name: string };
        secondFile: { name: string };
      }[];
    };

    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]).toMatchObject({ method: "ast" });
    expect(reportText).toContain("first.js");
    expect(reportText).toContain("second.js");
    expect(reportText).not.toContain("third.js");
    expect(reportText).not.toContain("excluded.js");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: semantic scans unexpectedly download large models or conceal unavailable infrastructure; Contract: missing local model fails with download guidance and leaves model cache empty.
it("requires explicit model download for semantic scans", async () => {
  const directory = await mkdtemp(join(tmpdir(), "toolkit-duplicates-model-"));

  try {
    const cache = join(directory, "cache");

    await mkdir(cache);
    await writeFile(join(directory, "first.js"), fixture);
    await writeFile(join(directory, "second.js"), fixture);

    const result = spawnSync(
      process.execPath,
      [cli, "duplicates", ".", "--semantic"],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, JSCPD_CACHE_DIR: cache },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("--semantic-download");

    const files = await readdir(cache, { recursive: true });

    expect(files).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: misspelled scan paths produce misleading clean reports; Contract: nonexistent paths and scans with no eligible files return failure.
it.each(["missing", "empty"])("rejects %s scan targets", async (target) => {
  const directory = await mkdtemp(join(tmpdir(), "toolkit-duplicates-empty-"));

  try {
    await mkdir(join(directory, "empty"));

    const result = spawnSync(process.execPath, [cli, "duplicates", target], {
      cwd: directory,
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
