import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  alignWeeks,
  blockBootstrapPValue,
  holm,
  laggedCorrelation,
  pearson,
  residualsOn,
  runLeadLag,
  weeklyBlocks,
  weeklyLogChanges,
} from "../src/lib/lead-lag.ts";
import { DAY_SECONDS, dayTime, isoDay, type DailyPoint } from "../src/lib/metrics.ts";
import { assertClose } from "./assert-close.ts";

const WEEK = 7 * DAY_SECONDS;
const day0 = dayTime("2025-01-05");

/** `count` consecutive days from day0 with values from `valueOf(dayIndex)`. */
const daily = (count: number, valueOf: (i: number) => number): DailyPoint[] =>
  Array.from({ length: count }, (_, i) => ({ time: day0 + i * DAY_SECONDS, value: valueOf(i) }));

/** Deterministic noise in [-1, 1]. */
const noise = (i: number, seed: number) => Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + Math.sin(i * 4.1414 + seed * 1.7) * 0.5;

describe("weeklyBlocks", () => {
  const days = daily(14, (i) => i + 1);
  const end = day0 + 13 * DAY_SECONDS;

  test("sums, averages or takes the last day of each 7-day block ending at endTime, oldest first", () => {
    assert.deepEqual(weeklyBlocks(days, "sum", end), [{ end: end - WEEK, value: 28 }, { end, value: 77 }]);
    assert.deepEqual(weeklyBlocks(days, "mean", end).map((w) => w.value), [4, 11]);
    assert.deepEqual(weeklyBlocks(days, "last", end).map((w) => w.value), [7, 14]);
  });

  test("leaves out a block with a missing day", () => {
    const gap = days.filter((_, i) => i !== 3);
    assert.deepEqual(weeklyBlocks(gap, "sum", end), [{ end, value: 77 }]);
  });
});

describe("weeklyLogChanges", () => {
  test("returns the log change between consecutive weeks only", () => {
    const weeks = [
      { end: 0, value: 100 },
      { end: WEEK, value: 200 },
      { end: 3 * WEEK, value: 300 },
    ];
    const changes = weeklyLogChanges(weeks);
    assert.equal(changes.length, 1);
    assertClose(changes[0]!.value, Math.log(2));
  });
});

describe("alignWeeks", () => {
  test("keeps the weeks every series has", () => {
    const a = [{ end: WEEK, value: 1 }, { end: 2 * WEEK, value: 2 }, { end: 3 * WEEK, value: 3 }];
    const b = [{ end: 2 * WEEK, value: 20 }, { end: 3 * WEEK, value: 30 }, { end: 4 * WEEK, value: 40 }];
    assert.deepEqual(alignWeeks(a, b), { ends: [2 * WEEK, 3 * WEEK], values: [[2, 3], [20, 30]] });
  });

  test("keeps only the newest consecutive weeks, so a lag of one position is always one week", () => {
    const a = [1, 2, 4, 5, 6].map((n) => ({ end: n * WEEK, value: n }));
    assert.deepEqual(alignWeeks(a).ends, [4 * WEEK, 5 * WEEK, 6 * WEEK]);
  });
});

describe("pearson and laggedCorrelation", () => {
  test("pearson is 1 for a linear relation and null for a constant series", () => {
    assertClose(pearson([1, 2, 3, 4], [3, 5, 7, 9])!, 1);
    assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
  });

  test("finds the lag at which x leads y", () => {
    const x = Array.from({ length: 40 }, (_, i) => noise(i, 1));
    const y = Array.from({ length: 40 }, (_, i) => (i >= 2 ? x[i - 2]! : 0));
    assertClose(laggedCorrelation(x, y, 2)!, 1);
    assert.ok(Math.abs(laggedCorrelation(x, y, 0)!) < 0.9);
  });
});

describe("residualsOn", () => {
  test("returns the slope and what is left after the fit", () => {
    const x = [1, 2, 3, 4, 5];
    const y = x.map((v, i) => 2 * v + 1 + [0.1, -0.1, 0, 0.1, -0.1][i]!);
    const fit = residualsOn(y, x)!;
    assertClose(fit.beta, 2, 0.05);
    assertClose(fit.residuals.reduce((sum, v) => sum + v, 0), 0);
  });

  test("returns null for a constant regressor", () => {
    assert.equal(residualsOn([1, 2, 3], [5, 5, 5]), null);
  });
});

describe("blockBootstrapPValue", () => {
  const x = Array.from({ length: 80 }, (_, i) => noise(i, 2));

  test("is small enough to survive a correction across many tests when x leads y", () => {
    const y = x.map((_, i) => (i >= 1 ? x[i - 1]! : 0) + 0.2 * noise(i, 3));
    assert.ok(blockBootstrapPValue(x, y, 1, 4, 9_999, 1)! * 17 < 0.05);
  });

  test("is not small for an unrelated series and is the same on every run", () => {
    /** White noise: noise() repeats x's frequencies, so it would share x's rhythm. */
    const y = x.map((_, i) => (Math.sin(i * 91.7 + 3.1) * 43_758.5453) % 1);
    const p = blockBootstrapPValue(x, y, 1, 4, 999, 1)!;
    assert.ok(p > 0.05);
    assert.equal(blockBootstrapPValue(x, y, 1, 4, 999, 1), p);
  });
});

describe("holm", () => {
  test("multiplies sorted p-values by the remaining count and keeps them non-decreasing", () => {
    const adjusted = holm([0.01, 0.04, 0.03, 0.005]);
    [0.03, 0.06, 0.06, 0.02].forEach((expected, i) => assertClose(adjusted[i]!, expected));
  });

  test("caps adjusted p-values at 1", () => {
    assert.deepEqual(holm([0.6, 0.7]), [1, 1]);
  });
});

describe("runLeadLag", () => {
  const days = 7 * 60;
  const end = day0 + (days - 1) * DAY_SECONDS;
  const market = (i: number) => 100 * Math.exp(0.002 * i + 0.05 * noise(Math.floor(i / 7), 4));
  /** Prices run one day past the end: the 00:00 UTC price of the next day closes the last day. */
  const input = {
    intentsVolumeUsd: daily(days, (i) => 30_000_000 * Math.exp(0.004 * i + 0.3 * noise(Math.floor(i / 7), 5))),
    nearPriceUsd: daily(days + 1, (i) => market(i) * Math.exp(0.1 * noise(Math.floor(i / 7), 6))),
    btcPriceUsd: daily(days + 1, market),
    ethPriceUsd: daily(days + 1, market),
    activeAccounts: daily(days, (i) => 50_000 * Math.exp(0.2 * noise(Math.floor(i / 7), 7))),
    endTime: end,
  };

  test("runs every test on the aligned weeks with Holm-adjusted p-values", () => {
    const result = runLeadLag(input)!;
    assert.equal(result.to, isoDay(end));
    assert.equal(result.tests.filter((t) => t.question === "volumeLeadsPrice").length, 5);
    assert.equal(result.tests.length, 17);
    for (const t of result.tests) assert.ok(t.pAdjusted === null || t.pAdjusted >= (t.p ?? 0));
  });

  test("returns null when no week reaches the volume floor or too few weeks align", () => {
    assert.equal(runLeadLag({ ...input, intentsVolumeUsd: daily(days, () => 1_000) }), null);
    assert.equal(runLeadLag({ ...input, endTime: day0 + 70 * DAY_SECONDS }), null);
  });
});
