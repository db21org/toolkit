import assert from "node:assert/strict";

import { wait } from "@db21/toolkit/utils";
import { afterEach, test, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

test("resolves after the requested delay", async () => {
  vi.useFakeTimers();
  const completion = vi.fn();
  const waiting = wait(250).then(completion);

  await vi.advanceTimersByTimeAsync(249);
  assert.equal(completion.mock.calls.length, 0);

  await vi.advanceTimersByTimeAsync(1);
  await waiting;
  assert.equal(completion.mock.calls.length, 1);
});
