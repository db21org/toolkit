import nodeAssert from "node:assert/strict";

import type { Maybe } from "@db21/toolkit/utils";
import { assert } from "@db21/toolkit/utils";
import { test } from "vitest";

// eslint-disable-next-line db21-tests/require-justification -- Assertion signatures must narrow caller inputs, not only values TypeScript already knows are defined.
test("narrows nullish caller inputs to defined values", () => {
  const formatDefined = (value: Maybe<number> | undefined): string => {
    assert.defined(value, "Expected a defined value.");

    return value.toFixed();
  };

  nodeAssert.equal(formatDefined(1), "1");
});

// eslint-disable-next-line db21-tests/require-justification -- Runtime invariant failures must reject invalid values and preserve caller-provided error identity and diagnostics.
test("throws strings as errors and preserves error instances", () => {
  const expected = new TypeError("Expected failure.");

  assert.notDefined(undefined, "Expected a nullish value.");
  assert.notDefined(null, "Expected a nullish value.");
  assert.true(true, "Expected true.");
  assert.false(false, "Expected false.");

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
