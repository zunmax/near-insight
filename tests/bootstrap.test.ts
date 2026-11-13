import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { blockDraw, seededRandom, windowGrowthRange } from "../src/lib/bootstrap.ts";
import { monthlyRate } from "../src/lib/metrics.ts";
import { assertClose } from "./assert-close.ts";

const SETTINGS = { level: 0.95, meanBlock: 7, draws: 2000, seed: 42 };

/** 30 daily values that vary from day to day, so draws differ. */
const latest = Array.from({ length: 30 }, (_, i) => 100 + 20 * Math.sin(i));
const prior = Array.from({ length: 30 }, (_, i) => 80 + 20 * Math.cos(i * 1.3));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("seededRandom", () => {
  test("repeats the same numbers in [0, 1) for the same seed", () => {
    const draw = (seed: number) => {
      const random = seededRandom(seed);
      return Array.from({ length: 100 }, () => random());
    };
    assert.deepEqual(draw(7), draw(7));
    assert.notDeepEqual(draw(7), draw(8));
    assert.ok(draw(7).every((value) => value >= 0 && value < 1));
  });
});

describe("blockDraw", () => {
  test("copies one wrapping block from a random start when blocks never end", () => {
    const into = new Array<number>(5);
    blockDraw([1, 2, 3, 4, 5], Infinity, () => 0.5, into);
    assert.deepEqual(into, [3, 4, 5, 1, 2]);
  });

  test("starts a new block at every value when the mean block is one value", () => {
    const values = [0.1, 0.9, 0.7, 0.9, 0.4];
    let i = 0;
    const into = new Array<number>(3);
    /** The first value draws its start; each later one draws whether a new block starts, then where. */
    blockDraw([10, 20, 30], 1, () => values[i++]!, into);
    assert.deepEqual(into, [10, 30, 20]);
  });
});

describe("windowGrowthRange", () => {
  test("is the same for the same seed and differs for another", () => {
    const range = windowGrowthRange(latest, prior, 3, SETTINGS);
    assert.deepEqual(windowGrowthRange(latest, prior, 3, SETTINGS), range);
    assert.notDeepEqual(windowGrowthRange(latest, prior, 3, { ...SETTINGS, seed: 43 }), range);
  });

  test("has its low end at or below its high end, around the measured monthly growth", () => {
    const range = windowGrowthRange(latest, prior, 3, SETTINGS);
    const measured = monthlyRate(sum(latest) / sum(prior) - 1, 3)!;
    assert.ok(range !== null && range.low <= measured && measured <= range.high);
  });

  test("narrows to the growth itself when every day holds the same value", () => {
    const range = windowGrowthRange(new Array(30).fill(2), new Array(30).fill(1), 3, SETTINGS);
    assertClose(range?.low, 2 ** (1 / 3) - 1);
    assertClose(range?.high, 2 ** (1 / 3) - 1);
  });

  test("spans the lowest to the highest draw at a level of 1", () => {
    const full = windowGrowthRange(latest, prior, 3, { ...SETTINGS, level: 1 })!;
    const central = windowGrowthRange(latest, prior, 3, SETTINGS)!;
    assert.ok(full.low <= central.low && full.high >= central.high);
  });

  test("returns null for an empty window, no draws, an earlier window of zeros or no months", () => {
    assert.equal(windowGrowthRange([], prior, 3, SETTINGS), null);
    assert.equal(windowGrowthRange(latest, [], 3, SETTINGS), null);
    assert.equal(windowGrowthRange(latest, prior, 3, { ...SETTINGS, draws: 0 }), null);
    assert.equal(windowGrowthRange(latest, new Array(30).fill(0), 3, SETTINGS), null);
    assert.equal(windowGrowthRange(latest, prior, 0, SETTINGS), null);
  });
});
