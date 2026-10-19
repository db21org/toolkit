const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const positiveIntegerPattern = /^[1-9]\d*$/u;

export const createPreviewVersion = ({
  stableVersion,
  runNumber,
  runAttempt,
  sha,
}) => {
  const match = stableVersionPattern.exec(stableVersion);

  assert(match, "Expected latest to be a stable major.minor.patch version.");
  assert(
    positiveIntegerPattern.test(runNumber) &&
      positiveIntegerPattern.test(runAttempt),
    "Expected positive GitHub run number and attempt.",
  );
  assert(
    /^[a-f\d]{40}$/u.test(sha),
    "Expected a full lowercase Git commit SHA.",
  );

  const [, major, minor, patch] = match;

  return `${major}.${minor}.${BigInt(patch) + 1n}-dev.${runNumber}.${runAttempt}.g${sha.slice(0, 12)}`;
};
import assert from "node:assert/strict";
