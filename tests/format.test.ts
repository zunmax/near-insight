import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  compareWord,
  digitsApart,
  formatBps,
  formatChange,
  formatChangeFromZero,
  formatCompact,
  formatCorrelation,
  formatCount,
  formatDate,
  formatDateTimeUtc,
  formatDecimal,
  formatGrowth,
  formatGrowthRange,
  formatInteger,
  formatMonths,
  formatMonthYear,
  formatMoveFromZero,
  formatMultiple,
  formatNear,
  formatNearAboveZero,
  formatPace90d,
  formatPercent,
  formatPercentFromFull,
  formatPercentSplit,
  formatPValue,
  formatShortDate,
  formatSmallUsd,
  formatUsd,
  formatUtcTime,
  percentRounded,
  upperFirst,
  usdDigitsApart,
} from "../src/lib/format.ts";
import { dayTime } from "../src/lib/metrics.ts";

describe("percentRounded", () => {
  test("rounds a share as a percentage, half away from zero", () => {
    assert.equal(percentRounded(0.02481, 2), 2.48);
    assert.equal(percentRounded(-0.0005, 1), -0.1);
    assert.equal(percentRounded(-0.0004, 1), 0);
  });

  test("clears binary noise before rounding, so 1.805 stored as 1.80499… rounds up", () => {
    assert.equal(percentRounded(0.01805, 2), 1.81);
  });
});

describe("digitsApart", () => {
  test("returns the fewest decimals from `digits` at which the values round apart", () => {
    assert.equal(digitsApart(2.51, 2.5, 1), 2);
    assert.equal(digitsApart(2.5004, 2.5, 1), 4);
    assert.equal(digitsApart(3, 2.5, 1), 1);
  });

  test("returns `digits` for equal values or values apart only beyond three more decimals", () => {
    assert.equal(digitsApart(2.5, 2.5, 1), 1);
    assert.equal(digitsApart(2.50001, 2.5, 1), 1);
  });
});

describe("formatUsd", () => {
  test("prints amounts under $1,000 with fixed decimals and larger ones compact", () => {
    assert.equal(formatUsd(5.15), "$5.15");
    assert.equal(formatUsd(0), "$0.00");
    assert.equal(formatUsd(999.994), "$999.99");
    assert.equal(formatUsd(4.47e9), "$4.47B");
    assert.equal(formatUsd(240_370_000), "$240.37M");
  });

  test("goes compact once the amount rounds to $1,000", () => {
    assert.equal(formatUsd(999.996), "$1K");
  });

  test("prints a minus sign only when the rounded amount is negative", () => {
    assert.equal(formatUsd(-12.3), "−$12.30");
    assert.equal(formatUsd(-1500), "−$1.5K");
    assert.equal(formatUsd(-0.001), "$0.00");
  });

  test("shows at most `digits` decimals", () => {
    assert.equal(formatUsd(12_345_000, 3), "$12.345M");
    assert.equal(formatUsd(5, 0), "$5");
  });

  test("rounds the true value, not its binary approximation", () => {
    assert.equal(formatUsd(0.5 * 3.61), "$1.81");
  });
});

describe("usdDigitsApart", () => {
  test("returns the fewest decimals from 2 at which two amounts print apart", () => {
    assert.equal(usdDigitsApart(1.5, 2.5), 2);
    assert.equal(usdDigitsApart(1.001, 1.002), 3);
    assert.equal(usdDigitsApart(12_345_000, 12_346_000), 3);
  });

  test("returns 2 for equal amounts or ones still alike at 5 decimals", () => {
    assert.equal(usdDigitsApart(5, 5), 2);
    assert.equal(usdDigitsApart(1, 1.000001), 2);
  });
});

describe("formatSmallUsd", () => {
  test("prints amounts under a cent to three significant digits and others as formatUsd", () => {
    assert.equal(formatSmallUsd(0.000412), "$0.000412");
    assert.equal(formatSmallUsd(-0.000412), "−$0.000412");
    assert.equal(formatSmallUsd(0.25), "$0.25");
    assert.equal(formatSmallUsd(0), "$0.00");
  });
});

describe("formatCount", () => {
  test("uses the singular for exactly one and groups thousands", () => {
    assert.equal(formatCount(1, "validator"), "1 validator");
    assert.equal(formatCount(0, "validator"), "0 validators");
    assert.equal(formatCount(337, "validator"), "337 validators");
    assert.equal(formatCount(1234, "validator"), "1,234 validators");
  });
});

describe("formatPercent", () => {
  test("prints a share as a grouped percentage with exactly `digits` decimals", () => {
    assert.equal(formatPercent(0.0248), "2.48%");
    assert.equal(formatPercent(22.5), "2,250.00%");
    assert.equal(formatPercent(0.025, 0), "3%");
  });

  test("prints the minus sign only for a value that rounds below zero", () => {
    assert.equal(formatPercent(-0.0248, 1), "−2.5%");
    assert.equal(formatPercent(-0.00001), "0.00%");
  });
});

describe("formatPercentFromFull", () => {
  test("adds decimals until a share short of whole prints below 100%", () => {
    assert.equal(formatPercentFromFull(0.998, 1), "99.8%");
    assert.equal(formatPercentFromFull(0.9999, 1), "99.99%");
    assert.equal(formatPercentFromFull(1, 1), "100.0%");
  });
});

describe("formatPercentSplit", () => {
  test("prints a total and two parts that add up as printed", () => {
    assert.deepEqual(formatPercentSplit(0.161, 0.0161, 1), ["16.1%", "1.6%", "14.5%"]);
  });

  test("takes the second part from the rounded total less the rounded first, not its own rounding", () => {
    /** 0.25% rounds to 0.3%, so the second 0.25% prints 0.2% for the parts to add up to 0.5%. */
    assert.deepEqual(formatPercentSplit(0.005, 0.0025, 1), ["0.5%", "0.3%", "0.2%"]);
  });
});

describe("formatChange", () => {
  test("prints a plus or minus sign and no sign for a change that rounds to zero", () => {
    assert.equal(formatChange(0.614), "+61.4%");
    assert.equal(formatChange(-0.25, 0), "−25%");
    assert.equal(formatChange(-0.0004), "0.0%");
    assert.equal(formatChange(-0.0005), "−0.1%");
    assert.equal(formatChange(12.345), "+1,234.5%");
  });
});

describe("formatChangeFromZero", () => {
  test("adds decimals so a change that is not zero never prints as 0", () => {
    assert.equal(formatChangeFromZero(0.25), "+25%");
    assert.equal(formatChangeFromZero(0.004), "+0.4%");
    assert.equal(formatChangeFromZero(-0.00004), "−0.004%");
  });

  test("prints a zero change as 0%", () => {
    assert.equal(formatChangeFromZero(0), "0%");
  });
});

describe("formatMoveFromZero", () => {
  test("words a change as up or down with enough decimals, and zero as unchanged", () => {
    assert.equal(formatMoveFromZero(1.25), "up 125%");
    assert.equal(formatMoveFromZero(-0.004), "down 0.4%");
    assert.equal(formatMoveFromZero(-0.25), "down 25%");
    assert.equal(formatMoveFromZero(0), "unchanged");
  });
});

describe("formatGrowth", () => {
  test("words a change as grew, shrank or was unchanged at the printed precision", () => {
    assert.equal(formatGrowth(0.012, 1), "grew 1.2%");
    assert.equal(formatGrowth(-0.012, 1), "shrank 1.2%");
    assert.equal(formatGrowth(0.0004, 1), "was unchanged");
  });
});

describe("formatGrowthRange", () => {
  test("prints both ends with their signs", () => {
    assert.equal(formatGrowthRange({ low: 0.097, high: 0.311 }, 1), "+9.7% to +31.1%");
    assert.equal(formatGrowthRange({ low: -0.05, high: 0.1 }, 1), "−5.0% to +10.0%");
  });
});

describe("formatPace90d", () => {
  test("states the move, the monthly pace and its range", () => {
    assert.equal(
      formatPace90d("1.2M NEAR", "703K NEAR", 0.71, 0.196, 1, { low: 0.097, high: 0.311 }),
      "1.2M NEAR, up 71% from 703K NEAR in the 90 days before, a pace of 19.6% growth a month (95% range +9.7% to +31.1% a month)",
    );
  });

  test("words a falling pace as a decline and gives a small move enough decimals to show", () => {
    assert.equal(formatPace90d("a", "b", -0.004, -0.0013, 2, null), "a, down 0.4% from b in the 90 days before, a pace of 0.13% decline a month");
  });

  test("reads unchanged beside a pace that rounds to no growth", () => {
    assert.equal(formatPace90d("a", "b", 0.004, 0.0001, 1, null), "a, unchanged from b in the 90 days before, no growth a month");
  });
});

describe("formatCorrelation", () => {
  test("prints two decimals with a sign, and no sign when it rounds to zero", () => {
    assert.equal(formatCorrelation(0.143), "+0.14");
    assert.equal(formatCorrelation(-0.041), "−0.04");
    assert.equal(formatCorrelation(-0.001), "0.00");
    assert.equal(formatCorrelation(0.005), "+0.01");
  });
});

describe("formatMultiple", () => {
  test("prints a ratio in full with grouped thousands", () => {
    assert.equal(formatMultiple(1545.7), "1,546×");
    assert.equal(formatMultiple(2000), "2,000×");
    assert.equal(formatMultiple(0.962, 2), "0.96×");
  });

  test("adds decimals only while the value would print as 0×", () => {
    assert.equal(formatMultiple(0.4), "0.4×");
    assert.equal(formatMultiple(0.004), "0.004×");
    assert.equal(formatMultiple(0), "0×");
  });

  test("prints a negative ratio with the minus sign", () => {
    assert.equal(formatMultiple(-2.4), "−2×");
  });
});

describe("formatPValue", () => {
  test("prints three decimals, more when needed to tell p from alpha", () => {
    assert.equal(formatPValue(0.2063, 0.05), "0.206");
    assert.equal(formatPValue(0.0504, 0.05), "0.0504");
    assert.equal(formatPValue(0.05, 0.05), "0.050");
    assert.equal(formatPValue(0.001, 0.05), "0.001");
  });

  test("prints values under 0.001 as a bound", () => {
    assert.equal(formatPValue(0.0004, 0.05), "< 0.001");
  });
});

describe("formatBps", () => {
  test("prints a share in basis points with one decimal", () => {
    assert.equal(formatBps(0.00038), "3.8 bps");
    assert.equal(formatBps(-0.00038), "−3.8 bps");
    assert.equal(formatBps(0.000004), "0.0 bps");
  });
});

describe("formatCompact", () => {
  test("shortens large numbers to `digits` decimals", () => {
    assert.equal(formatCompact(1_309_614_393), "1.3B");
    assert.equal(formatCompact(1_309_614_393, 2), "1.31B");
    assert.equal(formatCompact(999), "999");
  });

  test("prints the minus sign, but not on a value that prints as 0", () => {
    assert.equal(formatCompact(-12_300), "−12.3K");
    assert.equal(formatCompact(-0.01), "0");
    assert.equal(formatCompact(0), "0");
  });
});

describe("formatNear", () => {
  test("prints a compact NEAR amount", () => {
    assert.equal(formatNear(2_164_886.4), "2.2M NEAR");
    assert.equal(formatNear(2_164_886.4, 2), "2.16M NEAR");
  });
});

describe("formatNearAboveZero", () => {
  test("prints a positive amount that would read as 0 as less than 0.1 NEAR", () => {
    assert.equal(formatNearAboveZero(0.04), "less than 0.1 NEAR");
    assert.equal(formatNearAboveZero(0.05), "0.1 NEAR");
    assert.equal(formatNearAboveZero(1500), "1.5K NEAR");
  });

  test("prints zero and negative amounts as formatNear does", () => {
    assert.equal(formatNearAboveZero(0), "0 NEAR");
    assert.equal(formatNearAboveZero(-0.04), "0 NEAR");
  });
});

describe("formatInteger and formatDecimal", () => {
  test("formatInteger rounds and groups thousands", () => {
    assert.equal(formatInteger(22_823.4), "22,823");
    assert.equal(formatInteger(1234.5), "1,235");
  });

  test("formatDecimal keeps up to three decimals, or three significant digits below 0.001", () => {
    assert.equal(formatDecimal(14_327.2834519), "14,327.283");
    assert.equal(formatDecimal(0.000412), "0.000412");
    assert.equal(formatDecimal(0), "0");
  });
});

describe("formatMonths", () => {
  test("states whole years as years and other spans as months", () => {
    assert.equal(formatMonths(24), "2 years");
    assert.equal(formatMonths(12), "1 year");
    assert.equal(formatMonths(18), "18 months");
    assert.equal(formatMonths(1), "1 month");
    assert.equal(formatMonths(0), "0 months");
  });
});

describe("dates and times", () => {
  test("prints UTC dates whatever the time of day", () => {
    assert.equal(formatShortDate(dayTime("2026-10-20")), "Oct 20");
    assert.equal(formatShortDate(dayTime("2026-10-20") + 86_399), "Oct 20");
    assert.equal(formatDate(dayTime("2026-10-20")), "Oct 20, 2026");
    assert.equal(formatMonthYear("2026-02-23"), "February 2026");
  });

  test("prints an ISO time as its UTC day and 24-hour time", () => {
    assert.equal(formatUtcTime("2026-11-09T16:48:00.000Z"), "16:48 UTC");
    assert.equal(formatUtcTime("2026-11-09T00:00:00.000Z"), "00:00 UTC");
    assert.equal(formatDateTimeUtc("2026-10-21T12:25:00.000Z"), "2026-10-21 12:25 UTC");
    assert.equal(formatDateTimeUtc("2026-10-21T23:30:00-02:00"), "2026-10-22 01:30 UTC");
  });
});

describe("upperFirst and compareWord", () => {
  test("upperFirst capitalizes the first letter only", () => {
    assert.equal(upperFirst("last 30 days"), "Last 30 days");
    assert.equal(upperFirst(""), "");
  });

  test("compareWord picks the word for more, less or the same", () => {
    assert.equal(compareWord(5, 3, "above", "below", "level with"), "above");
    assert.equal(compareWord(3, 5, "above", "below", "level with"), "below");
    assert.equal(compareWord(3, 3, "above", "below", "level with"), "level with");
  });
});
