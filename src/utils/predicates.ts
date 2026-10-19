import type { Maybe } from "./types.js";

export const isDefined = <Value>(value: Value): value is NonNullable<Value> => {
  // eslint-disable-next-line no-restricted-syntax -- This primitive defines the repository's nullish predicate.
  return value !== undefined && value !== null;
};

export const isNotDefined = <Value>(
  value: Value,
): value is Value & Maybe<undefined> => {
  // eslint-disable-next-line no-restricted-syntax -- This primitive defines the repository's opposite nullish predicate.
  return !isDefined(value);
};

export const isEmpty = (value: unknown): boolean => {
  if (typeof value === "string" || Array.isArray(value)) {
    // eslint-disable-next-line no-restricted-syntax -- This primitive defines the repository's empty predicate.
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (isDefined(value) && typeof value === "object") {
    const entryCount = Object.keys(value).length;

    return entryCount === 0;
  }

  return false;
};

export const isNotEmpty = (value: unknown): boolean => {
  // eslint-disable-next-line no-restricted-syntax -- This primitive defines the repository's opposite empty predicate.
  return !isEmpty(value);
};
