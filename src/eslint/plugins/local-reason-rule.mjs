const errorSeverity = 2;

const isInlineDowngrade = (comment, settingsPattern) => {
  if (comment.type !== "Block") {
    return false;
  }

  const directive = /^\s*eslint\s+([^]*?)(?:\s+--\s[^]*)?\s*$/u.exec(
    comment.value,
  );

  if (!directive) {
    return false;
  }

  for (const setting of directive[1].matchAll(settingsPattern)) {
    const [, doubleQuoted, singleQuoted, bare] = setting;
    const severity = doubleQuoted ?? singleQuoted ?? bare;

    if (severity !== "error" && Number(severity) !== errorSeverity) {
      return true;
    }
  }

  return false;
};

export const createLocalReasonRule = ({ rule, messages, isValidReason }) => {
  const escapedRule = rule.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const settingsPattern = new RegExp(
    String.raw`(?:^|[,{])\s*["']?${escapedRule}["']?\s*:\s*(?:\[\s*)?(?:"([^"]*)"|'([^']*)'|([^\s,\]}]+))`,
    "gu",
  );

  return {
    meta: { type: "problem", schema: [], messages },
    create(context) {
      return {
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            if (isInlineDowngrade(comment, settingsPattern)) {
              context.report({ loc: comment.loc, messageId: "inline" });
              continue;
            }

            const match =
              /^\s*(eslint-disable(?:-next-line|-line)?)\s+([^]*?)\s*$/u.exec(
                comment.value,
              );

            if (!match) {
              continue;
            }

            const [, kind, details] = match;
            const [rules, reason = ""] = details.split(/\s+--\s*/u);

            if (!rules.split(/\s*,\s*/u).includes(rule)) {
              continue;
            }

            if (kind === "eslint-disable" || !isValidReason(reason)) {
              context.report({ loc: comment.loc, messageId: "reason" });
            }
          }
        },
      };
    },
  };
};
