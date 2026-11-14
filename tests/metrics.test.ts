import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  absorption,
  annualized,
  breakEven,
  commonEnd,
  completeWindowEnd,
  coversWindow,
  dataCheck,
  DAY_SECONDS,
  daysInMonth,
  daysThrough,
  dayTime,
  extendBack,
  feeChain,
  firstFullMonthStart,
  firstOfMonth,
  flowYoY,
  gasCostNear,
  grossStakingYield,
  indexTo100,
  isoDay,
  levelChange,
  median,
  monthlyRate,
  monthlySums,
  monthlyTable,
  nakamotoCoefficient,
  ratio,
  ratioByDay,
  realYield,
  revenueMultiple,
  rollingWindows,
  seatPrices,
  sharedDays,
  sumByDay,
  sumWindow,
  toNear,
  valueAt,
  windowChange,
  windowMedian,
  windowValues,
  yearlyGrowthOfMedians,
  type DailyPoint,
} from "../src/lib/metrics.ts";
import { assertClose } from "./assert-close.ts";

/** Daily points from [day, value] pairs. */
const series = (...points: Array<[string, number]>): DailyPoint[] => points.map(([iso, value]) => ({ time: dayTime(iso), value }));

const fiveDays = series(["2026-01-01", 1], ["2026-01-02", 2], ["2026-01-03", 3], ["2026-01-04", 4], ["2026-01-05", 5]);

describe("sumWindow", () => {
  test("sums the last `days` calendar days ending at the latest point", () => {
    assert.equal(sumWindow(fiveDays, 3), 3 + 4 + 5);
  });

  test("shifts the window back by `offsetDays`", () => {
    assert.equal(sumWindow(fiveDays, 2, 2), 2 + 3);
  });

  test("ends the window at an explicit `endTime`", () => {
    assert.equal(sumWindow(fiveDays, 2, 0, dayTime("2026-01-04")), 3 + 4);
  });

  test("counts calendar days, not rows, when the series has gaps", () => {
    assert.equal(sumWindow(series(["2026-01-01", 10], ["2026-01-05", 20]), 3), 20);
  });
});

describe("commonEnd", () => {
  test("returns the earliest last day among the series", () => {
    assert.equal(commonEnd(fiveDays, fiveDays.slice(0, 3)), dayTime("2026-01-03"));
  });

  test("returns 0 when a series is empty", () => {
    assert.equal(commonEnd(fiveDays, []), 0);
  });
});

describe("completeWindowEnd", () => {
  const without = (daily: DailyPoint[], iso: string) => daily.filter((point) => point.time !== dayTime(iso));

  test("ends on the last day when every series has the whole window", () => {
    assert.equal(completeWindowEnd([fiveDays, fiveDays], 3, dayTime("2026-01-05"), 2), dayTime("2026-01-05"));
  });

  test("moves before a missing day, to the newest day whose window every series has", () => {
    const gap = without(fiveDays, "2026-01-04");
    assert.equal(completeWindowEnd([fiveDays, gap], 2, dayTime("2026-01-05"), 4), dayTime("2026-01-03"));
  });

  test("returns null when the window cannot move back far enough, or a series is empty", () => {
    assert.equal(completeWindowEnd([without(fiveDays, "2026-01-04")], 2, dayTime("2026-01-05"), 1), null);
    assert.equal(completeWindowEnd([fiveDays, []], 1, dayTime("2026-01-05"), 4), null);
  });
});

describe("windowChange", () => {
  test("compares the last `days` with the `days` before them", () => {
    assertClose(windowChange(fiveDays, 2), (4 + 5) / (2 + 3) - 1);
  });

  test("ends both windows at `endTime`", () => {
    assertClose(windowChange(fiveDays, 2, dayTime("2026-01-04")), (3 + 4) / (1 + 2) - 1);
  });

  test("returns null when the earlier window is empty", () => {
    assert.equal(windowChange(series(["2026-01-05", 5]), 2), null);
  });
});

describe("levelChange", () => {
  const supply = series(["2026-01-01", 100], ["2026-01-11", 110], ["2026-01-31", 121]);

  test("compares the last level with the level `days` earlier", () => {
    assertClose(levelChange(supply, 30), 0.21);
    assertClose(levelChange(supply, 20), 121 / 110 - 1);
  });

  test("accepts history up to 2 days short of `days`, reading the first level", () => {
    assertClose(levelChange(supply, 32), 0.21);
  });

  test("returns null without enough history", () => {
    assert.equal(levelChange(supply, 33), null);
    assert.equal(levelChange([], 30), null);
  });

  test("returns null when the earlier level is not positive", () => {
    assert.equal(levelChange(series(["2026-01-01", 0], ["2026-01-31", 10]), 30), null);
  });
});

describe("monthlyRate", () => {
  test("returns the compound monthly rate equal to a change over several months", () => {
    assertClose(monthlyRate(0.331, 3), 0.1);
    assertClose(monthlyRate(1, 12), 2 ** (1 / 12) - 1);
    assert.equal(monthlyRate(0, 5), 0);
  });
});

describe("monthlySums", () => {
  test("sums by UTC calendar month from `fromTime` on, oldest first", () => {
    const daily = series(["2026-01-30", 1], ["2026-01-31", 2], ["2026-02-01", 3], ["2026-02-15", 5], ["2026-03-01", 4]);
    assert.deepEqual(monthlySums(daily, dayTime("2026-01-31")), [
      { month: "2026-01", value: 2, days: 1 },
      { month: "2026-02", value: 8, days: 2 },
      { month: "2026-03", value: 4, days: 1 },
    ]);
  });
});

describe("firstOfMonth", () => {
  test("keeps only points on the first day of a UTC month", () => {
    const daily = series(["2026-01-01", 1], ["2026-01-15", 2], ["2026-02-01", 3], ["2026-02-02", 4]);
    assert.deepEqual(firstOfMonth(daily), series(["2026-01-01", 1], ["2026-02-01", 3]));
  });
});

describe("toNear", () => {
  test("divides each day's USD by the latest price on or before that day", () => {
    const prices = series(["2026-01-02", 2], ["2026-01-04", 4]);
    const usd = series(["2026-01-02", 10], ["2026-01-03", 10], ["2026-01-04", 20]);
    assert.deepEqual(toNear(usd, prices), series(["2026-01-02", 5], ["2026-01-03", 5], ["2026-01-04", 5]));
  });

  test("leaves out days before the first price and days without a positive price", () => {
    const prices = series(["2026-01-02", 2], ["2026-01-05", 0]);
    const usd = series(["2026-01-01", 10], ["2026-01-02", 10], ["2026-01-05", 7]);
    assert.deepEqual(toNear(usd, prices), series(["2026-01-02", 5]));
  });
});

describe("absorption", () => {
  test("returns burned, bought and combined shares of minted NEAR", () => {
    assert.deepEqual(absorption(30, 1000, 200, 300), {
      days: 30,
      mintedNear: 1000,
      burntNear: 200,
      burntShare: 0.2,
      boughtShare: 0.3,
      share: 0.5,
    });
  });

  test("returns null when nothing was minted", () => {
    assert.equal(absorption(30, 0, 200, 300), null);
  });
});

describe("feeChain", () => {
  test("adds the fee, buyback and capture rates to the flows", () => {
    const flows = { volumeUsd: 1_000_000, feesUsd: 1000, revenueUsd: 500, buybacksUsd: 250, boughtNear: 100 };
    const chain = feeChain(flows);
    assert.equal(chain.revenueUsd, 500);
    assert.equal(chain.boughtNear, 100);
    assertClose(chain.feeRate, 0.001);
    assertClose(chain.buybackRate, 0.00025);
    assertClose(chain.captureRate, 0.25);
  });

  test("returns null rates when volume or fees are zero", () => {
    const chain = feeChain({ volumeUsd: 0, feesUsd: 0, revenueUsd: 0, buybacksUsd: 0, boughtNear: 0 });
    assert.equal(chain.feeRate, null);
    assert.equal(chain.buybackRate, null);
    assert.equal(chain.captureRate, null);
  });
});

describe("breakEven", () => {
  const input = { days: 30, mintedNear: 3000, burntNear: 600, boughtNear: 900, volumeUsd: 3_000_000, priceUsd: 2, buybackRate: 0.0004 };

  test("returns the growth multiple and the daily volume whose buybacks cover minted minus burned NEAR", () => {
    const result = breakEven(input);
    assertClose(result.multiple, 3000 / (600 + 900));
    /** (3000 − 600) NEAR × $2 ÷ 0.0004 ÷ 30 days. */
    assertClose(result.volumePerDayUsd, 400_000);
    assert.equal(result.currentVolumePerDayUsd, 100_000);
  });

  test("needs no volume when the burn alone exceeds minted NEAR", () => {
    assert.equal(breakEven({ ...input, burntNear: 4000 }).volumePerDayUsd, 0);
  });

  test("returns null without a buyback rate or without burn and buybacks", () => {
    assert.equal(breakEven({ ...input, buybackRate: null }).volumePerDayUsd, null);
    assert.equal(breakEven({ ...input, buybackRate: 0 }).volumePerDayUsd, null);
    assert.equal(breakEven({ ...input, burntNear: 0, boughtNear: 0 }).multiple, null);
  });
});

describe("dataCheck", () => {
  test("returns a ÷ b − 1 and the UTC day of the window end", () => {
    const check = dataCheck(110, 100, 30, dayTime("2026-10-31") + 3600);
    assertClose(check.difference, 0.1);
    assert.equal(check.days, 30);
    assert.equal(check.through, "2026-10-31");
  });

  test("returns a null difference when b is not positive", () => {
    assert.equal(dataCheck(110, 0, null, dayTime("2026-10-31")).difference, null);
  });
});

describe("monthlyTable", () => {
  const first = series(["2026-01-30", 1], ["2026-01-31", 2], ["2026-02-01", 3], ["2026-02-02", 4]);
  const other = series(["2026-01-29", 100], ["2026-01-30", 10], ["2026-01-31", 20], ["2026-02-01", 30], ["2026-02-02", 50], ["2026-02-03", 40]);

  test("sums every series by month over the first series' days only", () => {
    assert.deepEqual(monthlyTable({ first, other }, dayTime("2026-02-02")), [
      { month: "2026-01", days: 2, sums: { first: 3, other: 30 } },
      { month: "2026-02", days: 2, sums: { first: 7, other: 80 } },
    ]);
  });

  test("leaves out days after `endTime`, so a partial month counts fewer days", () => {
    assert.deepEqual(monthlyTable({ first, other }, dayTime("2026-02-01")), [
      { month: "2026-01", days: 2, sums: { first: 3, other: 30 } },
      { month: "2026-02", days: 1, sums: { first: 3, other: 30 } },
    ]);
  });
});

describe("revenueMultiple", () => {
  test("divides market cap by the window's revenue, annualized, only where the whole window is stored", () => {
    const marketCap = series(["2026-01-02", 1_000], ["2026-01-03", 2_000], ["2026-01-05", 3_000]);
    const revenue = series(["2026-01-01", 1], ["2026-01-02", 1], ["2026-01-03", 3], ["2026-01-05", 1]);
    const rows = revenueMultiple(marketCap, revenue, 2);
    /** 01-02: 1,000 ÷ ((1 + 1) × 365 ÷ 2); 01-03: 2,000 ÷ ((1 + 3) × 365 ÷ 2); 01-05 has no revenue on 01-04, so it is left out. */
    assert.deepEqual(
      rows.map((row) => row.time),
      [dayTime("2026-01-02"), dayTime("2026-01-03")],
    );
    assertClose(rows[0]?.value, 1_000 / 365);
    assertClose(rows[1]?.value, 2_000 / 730);
  });
});

describe("windowMedian", () => {
  const daily = series(["2026-01-01", 5], ["2026-01-02", 1], ["2026-01-03", 4], ["2026-01-04", 2], ["2026-01-05", 3]);

  test("returns the median of the points in the window", () => {
    assert.equal(windowMedian(daily, 3), 3);
    assert.equal(windowMedian(daily, 4), 2.5);
    assert.equal(windowMedian(daily, 2, 3), 3);
  });

  test("returns null when no point falls in the window", () => {
    assert.equal(windowMedian([], 3), null);
    assert.equal(windowMedian(daily, 2, 10), null);
  });
});

describe("ratio", () => {
  test("divides by a positive whole and returns null otherwise", () => {
    assert.equal(ratio(1, 4), 0.25);
    assert.equal(ratio(1, 0), null);
    assert.equal(ratio(1, -2), null);
  });
});

describe("annualized", () => {
  test("returns the yearly rate of a flow as a share of the base", () => {
    assertClose(annualized(2, 73, 100), 0.1);
  });

  test("returns null for zero days or a zero base", () => {
    assert.equal(annualized(2, 0, 100), null);
    assert.equal(annualized(2, 73, 0), null);
  });
});

describe("nakamotoCoefficient", () => {
  test("counts the largest stakes needed to exceed the threshold", () => {
    assert.equal(nakamotoCoefficient([40, 30, 20, 10], 1 / 3), 1);
    assert.equal(nakamotoCoefficient([40, 30, 20, 10], 0.5), 2);
  });

  test("requires strictly more than the threshold", () => {
    assert.equal(nakamotoCoefficient([25, 25, 25, 25], 0.5), 3);
  });

  test("returns the validator count when the threshold cannot be exceeded", () => {
    assert.equal(nakamotoCoefficient([25, 25, 25, 25], 1), 4);
    assert.equal(nakamotoCoefficient([], 1 / 3), 0);
  });
});

describe("seatPrices", () => {
  test("prices a chunk seat by stake ratio and a producer seat by the smallest producer stake", () => {
    const validators = [
      { stakeNear: 1000, producesBlocks: true },
      { stakeNear: 600, producesBlocks: true },
      { stakeNear: 300, producesBlocks: false },
      { stakeNear: 100, producesBlocks: false },
    ];
    assert.deepEqual(seatPrices(validators, 0.01), { chunkValidatorNear: 20, blockProducerNear: 600, producers: 2 });
  });

  test("returns a null producer price without producers", () => {
    assert.deepEqual(seatPrices([{ stakeNear: 500, producesBlocks: false }], 0.01), { chunkValidatorNear: 5, blockProducerNear: null, producers: 0 });
  });
});

describe("grossStakingYield", () => {
  test("divides the NEAR minted a year, less the treasury's share, by the NEAR staked", () => {
    assertClose(grossStakingYield(25_000_000, 0.1, 450_000_000), 0.05);
  });

  test("returns null when nothing is staked", () => {
    assert.equal(grossStakingYield(25_000_000, 0.1, 0), null);
  });
});

describe("indexTo100", () => {
  test("divides every point by the first and multiplies by 100", () => {
    assert.deepEqual(indexTo100([{ time: 1, value: 50 }, { time: 2, value: 75 }]), [{ time: 1, value: 100 }, { time: 2, value: 150 }]);
  });

  test("returns no points when the first value is not positive or the series is empty", () => {
    assert.deepEqual(indexTo100([{ time: 1, value: 0 }, { time: 2, value: 5 }]), []);
    assert.deepEqual(indexTo100([]), []);
  });
});

describe("realYield", () => {
  test("deflates a nominal yield by supply growth", () => {
    assertClose(realYield(0.05, 0.025), 1.05 / 1.025 - 1);
  });

  test("is zero when the yield equals the growth, negative when below it", () => {
    assertClose(realYield(0.03, 0.03), 0);
    assert.ok(realYield(0.01, 0.025) < 0);
  });
});

/** Consecutive daily points of `values`, the last on `last`. */
const run = (last: string, values: number[]): DailyPoint[] =>
  values.map((value, i) => ({ time: dayTime(last) - (values.length - 1 - i) * DAY_SECONDS, value }));

describe("gasCostNear", () => {
  test("prices teragas at a gas price in yoctoNEAR", () => {
    assertClose(gasCostNear(1e8, 0.446), 0.0000446);
    assert.equal(gasCostNear(0, 1), 0);
  });
});

describe("rollingWindows", () => {
  test("sums consecutive windows ending at the latest point, oldest first", () => {
    assert.deepEqual(rollingWindows(fiveDays, 2, 2), [
      { end: dayTime("2026-01-03"), value: 2 + 3 },
      { end: dayTime("2026-01-05"), value: 4 + 5 },
    ]);
  });

  test("returns no windows for an empty series or a count of zero", () => {
    assert.deepEqual(rollingWindows([], 2, 2), []);
    assert.deepEqual(rollingWindows(fiveDays, 2, 0), []);
  });
});

describe("valueAt", () => {
  const prices = series(["2026-01-02", 2], ["2026-01-04", 4]);

  test("returns the last value at or before the time", () => {
    assert.equal(valueAt(prices, dayTime("2026-01-02")), 2);
    assert.equal(valueAt(prices, dayTime("2026-01-03")), 2);
    assert.equal(valueAt(prices, dayTime("2026-01-04")), 4);
    assert.equal(valueAt(prices, dayTime("2026-01-10")), 4);
  });

  test("returns the first value before the series starts, and 0 for an empty series", () => {
    assert.equal(valueAt(prices, dayTime("2026-01-01")), 2);
    assert.equal(valueAt([], dayTime("2026-01-01")), 0);
  });
});

describe("coversWindow", () => {
  const gap = fiveDays.filter((point) => point.time !== dayTime("2026-01-04"));

  test("is true only when every day of the window has a value", () => {
    assert.equal(coversWindow(fiveDays, 5), true);
    assert.equal(coversWindow(fiveDays, 6), false);
    assert.equal(coversWindow(gap, 2), false);
    assert.equal(coversWindow([], 1), false);
  });

  test("checks the window `offsetDays` before `endTime`", () => {
    assert.equal(coversWindow(gap, 2, 2), true);
    assert.equal(coversWindow(gap, 3, 0, dayTime("2026-01-03")), true);
  });
});

describe("flowYoY", () => {
  const end = dayTime("2026-11-09");
  /** 400 days of 1, then 2 on each of the last 30. */
  const flow = run("2026-11-09", Array.from({ length: 400 }, (_, i) => (i >= 370 ? 2 : 1)));

  test("compares the 30 days to `end` with the same 30 days a year earlier", () => {
    assert.deepEqual(flowYoY(flow, end), { last30d: 60, yearAgo30d: 30, change: 1 });
  });

  test("keeps the sums but has no change when a day is missing from either window or the earlier one is zero", () => {
    const yearAgoDay = end - 380 * DAY_SECONDS;
    assert.deepEqual(flowYoY(flow.filter((point) => point.time !== yearAgoDay), end), { last30d: 60, yearAgo30d: 29, change: null });
    assert.deepEqual(flowYoY(flow.slice(-100), end), { last30d: 60, yearAgo30d: 0, change: null });
    const zeroYearAgo = flow.map((point) => (point.time <= end - 365 * DAY_SECONDS ? { ...point, value: 0 } : point));
    assert.equal(flowYoY(zeroYearAgo, end).change, null);
  });
});

describe("yearlyGrowthOfMedians", () => {
  test("compares the median of the last `endDays` with the median a year earlier, unswayed by one off reading", () => {
    const values = Array.from({ length: 400 }, (_, i): number => (i >= 393 ? 110 : 100));
    values[396] = 1000;
    assertClose(yearlyGrowthOfMedians(run("2026-11-09", values), 7), 0.1);
  });

  test("scales to a year from the first `endDays` when the history is shorter than a year", () => {
    /** The base window ends on day 7 of 100, 93 days before the last. */
    const values = Array.from({ length: 100 }, (_, i) => (i >= 93 ? 110 : 100));
    assertClose(yearlyGrowthOfMedians(run("2026-11-09", values), 7), 1.1 ** (365 / 93) - 1);
  });

  test("returns null when the windows overlap, the earlier median is zero, or there is no data", () => {
    assert.equal(yearlyGrowthOfMedians(run("2026-11-09", new Array(10).fill(1)), 7), null);
    assert.equal(yearlyGrowthOfMedians(run("2026-11-09", Array.from({ length: 100 }, (_, i) => (i < 7 ? 0 : 1))), 7), null);
    assert.equal(yearlyGrowthOfMedians([], 7), null);
  });
});

describe("extendBack", () => {
  test("puts the history from before the series' first day in front of it", () => {
    const history = series(["2026-01-01", 1], ["2026-01-02", 2], ["2026-01-03", 30]);
    assert.deepEqual(extendBack(series(["2026-01-03", 3], ["2026-01-04", 4]), history), series(["2026-01-01", 1], ["2026-01-02", 2], ["2026-01-03", 3], ["2026-01-04", 4]));
    assert.deepEqual(extendBack([], history), []);
  });
});

describe("sumByDay", () => {
  test("adds the series on the days all of them have", () => {
    const a = series(["2026-01-01", 1], ["2026-01-02", 2], ["2026-01-03", 3]);
    const b = series(["2026-01-02", 20], ["2026-01-03", 30], ["2026-01-04", 40]);
    assert.deepEqual(sumByDay(a, b), series(["2026-01-02", 22], ["2026-01-03", 33]));
    assert.deepEqual(sumByDay(a), a);
    assert.deepEqual(sumByDay(), []);
  });
});

describe("sharedDays and ratioByDay", () => {
  const base = series(["2026-01-01", 1], ["2026-01-02", 2], ["2026-01-03", 3]);

  test("sharedDays keeps both series' points on the days both have", () => {
    const other = series(["2026-01-02", 20], ["2026-01-03", 30], ["2026-01-04", 40]);
    assert.deepEqual(sharedDays(base, other), [series(["2026-01-02", 2], ["2026-01-03", 3]), series(["2026-01-02", 20], ["2026-01-03", 30])]);
  });

  test("ratioByDay divides on the days both have and the denominator is positive", () => {
    const denominator = series(["2026-01-01", 2], ["2026-01-02", 0], ["2026-01-04", 5]);
    assert.deepEqual(ratioByDay(base, denominator), series(["2026-01-01", 0.5]));
  });
});

describe("firstFullMonthStart", () => {
  test("returns the start of the first month with a value above zero on every day", () => {
    /** January from the 2nd, all of February and March 1st. */
    assert.equal(firstFullMonthStart(run("2026-03-01", new Array(59).fill(1))), dayTime("2026-02-01"));
  });

  test("returns null when a zero or a missing day leaves every month short", () => {
    const values = new Array(59).fill(1);
    values[40] = 0;
    assert.equal(firstFullMonthStart(run("2026-03-01", values)), null);
    assert.equal(firstFullMonthStart(run("2028-02-28", new Array(28).fill(1))), null);
    assert.equal(firstFullMonthStart([]), null);
  });
});

describe("calendar days", () => {
  test("isoDay and dayTime convert between unix seconds and UTC days", () => {
    assert.equal(isoDay(dayTime("2026-11-09")), "2026-11-09");
    assert.equal(isoDay(dayTime("2026-11-09") + DAY_SECONDS - 1), "2026-11-09");
    assert.equal(dayTime("2026-11-10") - dayTime("2026-11-09"), DAY_SECONDS);
  });

  test("daysInMonth counts leap years", () => {
    assert.equal(daysInMonth("2026-02"), 28);
    assert.equal(daysInMonth("2028-02"), 29);
    assert.equal(daysInMonth("2100-02"), 28);
    assert.equal(daysInMonth("2026-04"), 30);
    assert.equal(daysInMonth("2026-12"), 31);
  });

  test("daysThrough counts both the start day and the end day", () => {
    assert.equal(daysThrough("2026-11-01", dayTime("2026-11-30")), 30);
    assert.equal(daysThrough("2026-11-01", dayTime("2026-11-01")), 1);
    assert.equal(daysThrough("2026-11-01", dayTime("2026-11-01") + 3600), 1);
    assert.equal(daysThrough("2026-11-01", dayTime("2026-10-31")), 0);
  });
});

describe("median and windowValues", () => {
  test("median returns the middle value or the mean of the two middle values, leaving the input as it is", () => {
    const values = [4, 1, 3, 2];
    assert.equal(median(values), 2.5);
    assert.deepEqual(values, [4, 1, 3, 2]);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([]), null);
  });

  test("windowValues returns the window's values oldest first", () => {
    assert.deepEqual(windowValues(fiveDays, 3), [3, 4, 5]);
    assert.deepEqual(windowValues(fiveDays, 2, 1), [3, 4]);
    assert.deepEqual(windowValues([], 3), []);
  });
});
