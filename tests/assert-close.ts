import assert from "node:assert/strict";

/** Asserts `actual` is a number within `tolerance` of `expected`, scaled by |expected| once it exceeds 1, for floating-point results. */
export function assertClose(actual: number | null | undefined, expected: number, tolerance = 1e-9): void {
  assert.equal(typeof actual, "number", `expected a number close to ${expected}, got ${actual}`);
  const difference = Math.abs((actual as number) - expected);
  assert.ok(difference <= tolerance * Math.max(1, Math.abs(expected)), `expected ${actual} to be close to ${expected}`);
}
