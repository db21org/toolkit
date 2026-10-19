import { isDefined, isNotDefined } from "./predicates.js";
import type { Maybe } from "./types.js";

type AssertionFailure = Error | string;

type Assert = Readonly<{
  defined: <Value>(
    value: Value,
    failure: AssertionFailure,
  ) => asserts value is NonNullable<Value>;
  false: (value: boolean, failure: AssertionFailure) => asserts value is false;
  notDefined: <Value>(
    value: Value,
    failure: AssertionFailure,
  ) => asserts value is Value & Maybe<undefined>;
  true: (value: unknown, failure: AssertionFailure) => asserts value;
}>;

const throwFailure = (failure: AssertionFailure): never => {
  throw typeof failure === "string" ? new Error(failure) : failure;
};

const assertDefined = <Value>(
  value: Value,
  failure: AssertionFailure,
): asserts value is NonNullable<Value> => {
  if (isNotDefined(value)) {
    throwFailure(failure);
  }
};

const assertFalse = (
  value: boolean,
  failure: AssertionFailure,
): asserts value is false => {
  if (value) {
    throwFailure(failure);
  }
};

const assertNotDefined = <Value>(
  value: Value,
  failure: AssertionFailure,
): asserts value is Value & Maybe<undefined> => {
  if (isDefined(value)) {
    throwFailure(failure);
  }
};

const assertTrue = (
  value: unknown,
  failure: AssertionFailure,
): asserts value => {
  if (value !== true) {
    throwFailure(failure);
  }
};

/** Runtime assertions with TypeScript control-flow narrowing. */
export const assert: Assert = {
  defined: assertDefined,
  false: assertFalse,
  notDefined: assertNotDefined,
  true: assertTrue,
};
