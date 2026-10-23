import assert from "node:assert/strict";

const stablePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const previewPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-dev\.[1-9]\d*\.[1-9]\d*\.g[a-f\d]{12}$/u;

export const compareStableVersions = (left, right) => {
  const leftParts = stablePattern.exec(left);
  const rightParts = stablePattern.exec(right);

  assert(
    leftParts && rightParts,
    "Expected stable major.minor.patch versions.",
  );

  return (
    leftParts
      .slice(1)
      .map((part, index) => BigInt(part) - BigInt(rightParts[index + 1]))
      .find((part) => part !== 0n) ?? 0n
  );
};

export const createReleaseVersion = ({ devVersion, latestVersion }) => {
  const preview = previewPattern.exec(devVersion);

  assert(preview, "Expected dev to use the toolkit preview version format.");

  const parts = preview.slice(1, 4);
  const version = parts.join(".");

  assert(
    compareStableVersions(version, latestVersion) > 0n,
    "Release version must be newer than latest.",
  );

  return version;
};

export const validateArchiveEntries = (paths, details) => {
  assert(
    paths.includes("package/package.json"),
    "Expected an npm package archive.",
  );
  assert(
    paths.every(
      (path) =>
        path.startsWith("package/") &&
        !path.includes("\\") &&
        !path.split("/").includes(".."),
    ),
    "Unsafe package archive path.",
  );
  assert(
    details.every((line) => /^[d-]/u.test(line)),
    "Package archive must contain only files and directories.",
  );
};
