import tseslint from "typescript-eslint";

import { addSizeGuidance } from "./size-guidance.mjs";

const validator = "db21-sql/require-local-reason";
const pending = new Map();

const disablesValidator = (comment) => {
  const disable =
    /^\s*eslint-disable(?:-next-line|-line)?\s+([^]*?)(?:\s+--\s[^]*)?\s*$/u.exec(
      comment.value,
    );

  if (disable) {
    return disable[1].split(/[\s,]+/u).includes(validator);
  }

  if (comment.type !== "Block") {
    return false;
  }

  const directive = /^\s*eslint\s+([^]*?)(?:\s+--\s[^]*)?\s*$/u.exec(
    comment.value,
  );

  if (!directive) {
    return false;
  }

  const settings = directive[1].matchAll(
    /(?:^|[,{])\s*["']?db21-sql\/require-local-reason["']?\s*:\s*(?:\[\s*)?(?:"([^"]*)"|'([^']*)'|([^\s,\]}]+))/gu,
  );

  return [...settings].some((setting) => {
    const severity = setting[1] ?? setting[2] ?? setting[3];

    return severity !== "error" && Number(severity) !== 2;
  });
};

// Processor diagnostics are added after ESLint applies inline suppressions.
export const rawSqlGuardProcessor = {
  meta: { name: "db21-sql-policy-guard", version: "1.0.0" },
  preprocess(text, filename) {
    let comments;

    try {
      const { ast } = tseslint.parser.parseForESLint(text, {
        comment: true,
        loc: true,
        filePath: filename,
        ecmaFeatures: { jsx: true },
      });

      comments = ast.comments ?? [];
    } catch {
      // The configured parser reports invalid source; never replace its diagnostics.
      comments = [];
    }

    pending.set(
      filename,
      comments.filter(disablesValidator).map((comment) => ({
        ruleId: "db21-sql/protected-validator",
        severity: 2,
        message:
          "Do not disable or downgrade db21-sql/require-local-reason; justify individual SQL operations instead.",
        line: comment.loc.start.line,
        column: comment.loc.start.column + 1,
      })),
    );

    return [text];
  },
  postprocess(messages, filename) {
    const violations = pending.get(filename) ?? [];

    pending.delete(filename);

    return addSizeGuidance([...messages.flat(), ...violations]);
  },
  supportsAutofix: true,
};
