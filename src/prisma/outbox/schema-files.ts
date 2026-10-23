import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { assert, isDefined, isEmpty } from "@db21/toolkit/utils";

type Token = Readonly<{ text: string; index: number }>;

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];

  for (const match of source.matchAll(
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|[A-Za-z_]\w*|[{}=]/gu,
  )) {
    if (!match[0].startsWith("//") && !match[0].startsWith("/*")) {
      tokens.push({ text: match[0], index: match.index });
    }
  }

  return tokens;
};

/**
 * Preserves explicit generator outputs when schema files move to staging.
 * @param source Original Prisma schema text.
 * @param file Original schema file location.
 * @returns Schema with absolute static generator outputs.
 */
const relocateGenerators = (source: string, file: string): string => {
  const tokens = tokenize(source);
  const edits: { start: number; end: number; value: string }[] = [];
  let generator = false;
  let depth = 0;

  for (const [index, token] of tokens.entries()) {
    if (depth === 0 && token.text === "generator") {
      generator = true;
    }

    if (token.text === "{") {
      depth += 1;
    } else if (token.text === "}") {
      depth -= 1;
      generator = depth === 0 ? false : generator;
    } else if (
      generator &&
      depth === 1 &&
      token.text === "output" &&
      tokens[index + 1]?.text === "="
    ) {
      const output = tokens[index + 2];

      assert.true(
        isDefined(output) && output.text.startsWith('"'),
        "Generator output must be a static string when assembling schemas.",
      );

      const value: unknown = JSON.parse(output.text);

      assert.true(
        typeof value === "string",
        "Generator output must be a string.",
      );
      edits.push({
        start: output.index,
        end: output.index + output.text.length,
        value: JSON.stringify(resolve(dirname(file), value)),
      });
    }
  }

  for (const edit of edits.toReversed()) {
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  }

  return source;
};

/**
 * Reads schema files without following directory or file symlinks.
 * @param root Product schema directory.
 * @param directory Current directory within the schema tree.
 * @returns Relative filenames and relocated schema contents.
 */
export const readSchemaFiles = (
  root: string,
  directory = root,
): Map<string, string> => {
  assert.true(
    lstatSync(directory).isDirectory() &&
      !lstatSync(directory).isSymbolicLink(),
    "Schema source must contain real directories, not symlinks.",
  );

  const files = new Map<string, string>();

  for (const entry of readdirSync(directory, { withFileTypes: true }).toSorted(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const file = join(directory, entry.name);

    assert.false(
      entry.isSymbolicLink(),
      "Schema source must not contain symlinks.",
    );

    if (entry.isDirectory()) {
      for (const [name, source] of readSchemaFiles(root, file)) {
        files.set(name, source);
      }
    } else if (entry.name.endsWith(".prisma")) {
      assert.true(entry.isFile(), "Schema entries must be regular files.");

      const source = readFileSync(file, "utf8");
      const tokens = tokenize(source);

      assert.false(
        tokens.some(
          (token, index) =>
            ["model", "enum", "type", "view"].includes(token.text) &&
            tokens[index + 1]?.text === "OutboxMessage",
        ),
        "Remove the local OutboxMessage definition before composing the toolkit schema.",
      );
      files.set(relative(root, file), relocateGenerators(source, file));
    }
  }

  return files;
};

/**
 * Checks whether two paths overlap rather than trusting string prefixes.
 * @param parent Possible containing directory.
 * @param child Possible descendant.
 * @returns Whether child equals or lies below parent.
 */
export const containsPath = (parent: string, child: string): boolean => {
  const path = relative(parent, child);

  return isEmpty(path) || (!path.startsWith("..") && !isAbsolute(path));
};
