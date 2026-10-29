import { assert } from "./assertions.js";
import { isNotDefined, isNotEmpty } from "./predicates.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPACT_UUID_PATTERN = /--([A-Za-z0-9_-]{22})$/;
const hexDigitsPerByte = 2;
const hexadecimalRadix = 16;
const uuidByteLength = 16;
const timeLowEnd = 8;
const timeMidEnd = 12;
const timeHighEnd = 16;
const clockSequenceEnd = 20;

type ReadableUuidSlugInput = Readonly<{
  fallback: string;
  id: string;
  maximumReadableLength: number;
  value: string;
}>;

const encodeUuid = (id: string): string => {
  const hexadecimal = id.replaceAll("-", "");
  const bytes = Array.from(
    { length: hexadecimal.length / hexDigitsPerByte },
    (_, index) =>
      Number.parseInt(
        hexadecimal.slice(
          index * hexDigitsPerByte,
          index * hexDigitsPerByte + hexDigitsPerByte,
        ),
        hexadecimalRadix,
      ),
  );

  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const decodeUuid = (compactId: string): string | undefined => {
  try {
    const base64 = compactId.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(`${base64}==`);

    if (binary.length !== uuidByteLength) {
      return undefined;
    }

    const hexadecimal = Array.from(binary, (value) =>
      value
        .codePointAt(0)
        ?.toString(hexadecimalRadix)
        .padStart(hexDigitsPerByte, "0"),
    ).join("");

    const uuidFields = [
      hexadecimal.slice(0, timeLowEnd),
      hexadecimal.slice(timeLowEnd, timeMidEnd),
      hexadecimal.slice(timeMidEnd, timeHighEnd),
      hexadecimal.slice(timeHighEnd, clockSequenceEnd),
      hexadecimal.slice(clockSequenceEnd),
    ];

    return uuidFields.join("-");
  } catch {
    return undefined;
  }
};

/**
 * Builds a readable route segment with a reversible compact UUID suffix.
 * @param input Readable value, canonical UUID, fallback, and length limit.
 * @returns A readable route segment with a compact UUID suffix.
 */
export const createReadableUuidSlug = (
  input: ReadableUuidSlugInput,
): string => {
  assert.true(UUID_PATTERN.test(input.id), "Slug identity is invalid.");
  const compactId = encodeUuid(input.id);
  const readable = input.value
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, input.maximumReadableLength)
    .replaceAll(/-+$/g, "");

  return `${isNotEmpty(readable) ? readable : input.fallback}--${compactId}`;
};

/**
 * Reads a canonical UUID from a readable route segment.
 * @param reference Readable route segment or canonical UUID.
 * @returns The canonical UUID when the reference is valid.
 */
export const readReadableUuidSlug = (reference: string): string | undefined => {
  const compactId = COMPACT_UUID_PATTERN.exec(reference)?.[1];

  if (isNotDefined(compactId)) {
    return UUID_PATTERN.test(reference) ? reference.toLowerCase() : undefined;
  }

  const id = decodeUuid(compactId);

  return isNotDefined(id) || !UUID_PATTERN.test(id) ? undefined : id;
};
