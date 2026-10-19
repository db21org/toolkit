import nodeAssert from "node:assert/strict";

import type { Maybe } from "@db21/toolkit/utils";
import { assert } from "@db21/toolkit/utils";
import { test } from "vitest";

test("narrows nullish values to defined values", () => {
  const value: Maybe<number> | undefined = 1;

  assert.defined(value, "Expected a defined value.");

  nodeAssert.equal(value.toFixed(), "1");
});

test("supports the inverse nullish invariant", () => {
  const undefinedValue: string | undefined = undefined;
  const nullValue: Maybe<string> = null;

  assert.notDefined(undefinedValue, "Expected a nullish value.");
  assert.notDefined(nullValue, "Expected a nullish value.");

  nodeAssert.equal(undefinedValue, undefined);
  nodeAssert.equal(nullValue, null);
});

test("supports true and false boolean invariants", () => {
  assert.true(true, "Expected true.");
  assert.false(false, "Expected false.");
});

test("throws strings as errors and preserves error instances", () => {
  const expected = new TypeError("Expected failure.");

  nodeAssert.throws(
    () => {
      assert.defined(undefined, "Missing value.");
    },
    { message: "Missing value." },
  );
  nodeAssert.throws(
    () => {
      assert.defined(null, expected);
    },
    (error) => {
      nodeAssert.equal(error, expected);

      return true;
    },
  );
  nodeAssert.throws(() => {
    assert.notDefined("value", "Expected a nullish value.");
  });
  nodeAssert.throws(() => {
    assert.true(false, "Expected true.");
  });
  nodeAssert.throws(() => {
    assert.false(true, "Expected false.");
  });
});
