import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { COVERAGE_HORIZON_MONTHS, RECENT_PACE_MONTHS } from "../src/config/projections.ts";
import { FULL_BURN_PROTOCOL, HSP029 } from "../src/config/protocol.ts";
import { DAYS_PER_MONTH, dayTime } from "../src/lib/metrics.ts";
import {
  coveringGrowth,
  feeChainInput,
  growthTerms,
  hsp029Ramp,
  measuredBurnNote,
  project,
  projectedVolumeUsd,
  scenarioOutcome,
  seedInput,
  valuationScenarios,
} from "../src/lib/projection.ts";
import type { CoverageScenario, ProjectionInput, ProjectionSeed } from "../src/lib/projection.ts";
import { assertClose } from "./assert-close.ts";
import { holdingMetrics } from "./thesis-metrics-fixture.ts";

/** 12% max issuance mints 1% of supply a month; 60% of 500 NEAR fees burns 300 NEAR; 200 NEAR is bought. */
const base: ProjectionInput = {
  totalSupplyNear: 100_000,
  maxInflationRate: 0.12,
  targetInflationRate: null,
  rampDelayMonths: 3,
  rampMonths: 24,
  boughtNearPerMonth: 200,
  feesNearPerMonth: 500,
  burnShareOfFees: 0.6,
  buybackGrowth: 0,
  feeGrowth: 0,
  months: 3,
};

const seed: ProjectionSeed = {
  priceUsd: 2,
  totalSupplyNear: 1_250_000_000,
  maxInflationRate: 0.025,
  boughtNearPerMonth: 1_000_000,
  feesNearPerMonth: 200_000,
  measuredBurnShare: 0.7,
  fullBurn: false,
  burnShareOfFees: 0.7,
  takeRate: 0.0004,
  volumeUsdPerMonth: 5_000_000_000,
  feeRate: 0.001,
  captureRate: 0.4,
  hsp029Ramp: { delayMonths: HSP029.graceDays / DAYS_PER_MONTH, months: HSP029.rampMonths, startsAt: null },
  through: "2026-11-01",
};

describe("project", () => {
  test("adds issuance on the month's opening supply and removes only burned NEAR", () => {
    const rows = project(base);
    assert.deepEqual(
      rows.map((row) => row.month),
      [1, 2, 3],
    );
    assertClose(rows[0]?.issuanceNear, 1000);
    assertClose(rows[0]?.burnedNear, 300);
    assertClose(rows[0]?.boughtNear, 200);
    assertClose(rows[0]?.coverage, 0.5);
    assertClose(rows[0]?.supplyNear, 100_700);
    assertClose(rows[1]?.issuanceNear, 1007);
    assertClose(rows[1]?.coverage, 500 / 1007);
    assertClose(rows[1]?.supplyNear, 101_407);
    assertClose(rows[2]?.issuanceNear, 1014.07);
    assertClose(rows[2]?.supplyNear, 102_121.07);
  });

  test("grows fees every month and buybacks only for `buybackGrowthMonths`", () => {
    const rows = project({ ...base, buybackGrowth: 0.1, feeGrowth: 0.5, buybackGrowthMonths: 1 });
    assertClose(rows[0]?.boughtNear, 200);
    assertClose(rows[1]?.boughtNear, 220);
    assertClose(rows[2]?.boughtNear, 220);
    assertClose(rows[0]?.burnedNear, 300);
    assertClose(rows[1]?.burnedNear, 450);
    assertClose(rows[2]?.burnedNear, 675);
    /** 100,700 + 1,007 − 450, then + 1,012.57 − 675. */
    assertClose(rows[1]?.supplyNear, 101_257);
    assertClose(rows[2]?.supplyNear, 101_594.57);
  });

  test("keeps today's max rate when no target rate is set", () => {
    const rows = project({ ...base, months: 36 });
    assert.ok(rows.every((row) => row.issuanceRate === base.maxInflationRate));
  });

  test("holds the rate through the grace months, then ramps linearly to the HSP-029 target", () => {
    const rows = project({ ...base, maxInflationRate: 0.025, targetInflationRate: 0.016, months: 36 });
    const rateIn = (month: number) => rows[month - 1]?.issuanceRate;
    assertClose(rateIn(1), 0.025);
    assertClose(rateIn(3), 0.025);
    assertClose(rateIn(4), 0.025 - 0.009 / 24);
    assertClose(rateIn(15), 0.0205);
    assertClose(rateIn(27), 0.016);
    assertClose(rateIn(36), 0.016);
  });

  test("burns all fees with a 100% burn share", () => {
    const rows = project({ ...base, burnShareOfFees: 1 });
    assertClose(rows[0]?.burnedNear, 500);
    assertClose(rows[0]?.coverage, 0.7);
    assertClose(rows[0]?.supplyNear, 100_500);
  });

  test("does not burn supply below zero", () => {
    const rows = project({ ...base, totalSupplyNear: 100, feesNearPerMonth: 1000, burnShareOfFees: 1, months: 1 });
    assert.equal(rows[0]?.supplyNear, 0);
  });
});

describe("seedInput", () => {
  test("starts from the seed with no growth, today's rate and the HSP-029 timing", () => {
    assert.deepEqual(seedInput(seed, 36), {
      totalSupplyNear: 1_250_000_000,
      maxInflationRate: 0.025,
      targetInflationRate: null,
      rampDelayMonths: HSP029.graceDays / DAYS_PER_MONTH,
      rampMonths: HSP029.rampMonths,
      boughtNearPerMonth: 1_000_000,
      feesNearPerMonth: 200_000,
      burnShareOfFees: 0.7,
      buybackGrowth: 0,
      feeGrowth: 0,
      months: 36,
    });
  });

  test("buys proportionally less NEAR at a higher price and keeps the burn", () => {
    const input = seedInput(seed, 36, 2);
    assert.equal(input.boughtNearPerMonth, 500_000);
    assert.equal(input.feesNearPerMonth, 200_000);
  });
});

describe("coveringGrowth", () => {
  test("finds the growth of NEAR bought at which burn plus buybacks equal issuance in the last month, the burn held flat", () => {
    /** Month 2 mints 1% of 100,700 = 1,007 NEAR and burns 300, so 300 + 200 × (1 + g) = 1,007. */
    assertClose(coveringGrowth({ ...base, months: 2 }), 707 / 200 - 1);
  });

  test("applies the growth to buybacks every month, ignoring `buybackGrowthMonths`", () => {
    assertClose(coveringGrowth({ ...base, months: 2, buybackGrowthMonths: 0 }), 707 / 200 - 1);
  });

  test("keeps the input's own fee growth for the burn", () => {
    /** Fees grow 10%: month 2 burns 330 and mints 1,007, so 330 + 200 × (1 + g) = 1,007. */
    assertClose(coveringGrowth({ ...base, months: 2, feeGrowth: 0.1 }), 677 / 200 - 1);
  });

  test("gives full coverage at the horizon month of a seeded projection", () => {
    const input = seedInput(seed, 36);
    const growth = coveringGrowth(input);
    assert.ok(growth !== null && growth > 0);
    const coverageAt = (g: number) => project({ ...input, buybackGrowth: g }).at(-1)?.coverage;
    assertClose(coverageAt(growth), 1);
    assert.ok((coverageAt(growth * 0.99) ?? 1) < 1);
  });

  test("returns the steepest fall that still covers issuance when burn and buybacks already cover it", () => {
    /** Month 2 mints 1,007 NEAR and burns 300, so 300 + 2,000 × (1 + g) = 1,007. */
    assertClose(coveringGrowth({ ...base, months: 2, boughtNearPerMonth: 2000 }), 707 / 2000 - 1);
  });

  test("returns −1 when burn alone covers issuance", () => {
    assert.equal(coveringGrowth({ ...base, months: 2, feesNearPerMonth: 5000, burnShareOfFees: 1 }), -1);
  });

  test("returns null when nothing is bought", () => {
    assert.equal(coveringGrowth({ ...base, boughtNearPerMonth: 0 }), null);
  });
});

describe("hsp029Ramp", () => {
  test("starts the ramp the grace days after the timelock ends, counted in months from the data day", () => {
    const ramp = hsp029Ramp("2026-11-16T16:48:00.000Z", dayTime("2026-11-09"));
    /** 97 days and 16.8 hours from 2026-11-09 to 2027-02-14 16:48 UTC. */
    assertClose(ramp.delayMonths, 97.7 / DAYS_PER_MONTH);
    assert.equal(ramp.months, HSP029.rampMonths);
    assert.equal(ramp.startsAt, "2027-02-14T16:48:00.000Z");
  });

  test("has no delay and the full ramp when the data day is the start", () => {
    assert.deepEqual(hsp029Ramp("2026-01-01T00:00:00.000Z", dayTime("2026-04-01")), { delayMonths: 0, months: 24, startsAt: "2026-04-01T00:00:00.000Z" });
  });

  test("once the ramp has started, ramps over the months left, and over none once it is over", () => {
    const started = hsp029Ramp("2026-01-01T00:00:00.000Z", dayTime("2026-10-01"));
    assert.equal(started.delayMonths, 0);
    assertClose(started.months, 24 - 183 / DAYS_PER_MONTH);
    assert.equal(hsp029Ramp("2026-01-01T00:00:00.000Z", dayTime("2028-04-01")).months, 0);
  });

  test("uses a full grace period without a valid timelock end", () => {
    const fallback = { delayMonths: HSP029.graceDays / DAYS_PER_MONTH, months: HSP029.rampMonths, startsAt: null };
    assert.deepEqual(hsp029Ramp(null, dayTime("2026-11-09")), fallback);
    assert.deepEqual(hsp029Ramp("not a date", dayTime("2026-11-09")), fallback);
  });
});

describe("measuredBurnNote", () => {
  test("notes the full burn only while the measured share is below it", () => {
    assert.equal(measuredBurnNote({ ...seed, fullBurn: true, measuredBurnShare: 0.78 }), `; all are burned since protocol ${FULL_BURN_PROTOCOL}`);
    assert.equal(measuredBurnNote({ ...seed, fullBurn: true, measuredBurnShare: 1 }), "");
    assert.equal(measuredBurnNote({ ...seed, fullBurn: false, measuredBurnShare: 0.7 }), "");
    assert.equal(measuredBurnNote(null), "");
  });
});

describe("feeChainInput", () => {
  test("buys the volume × fee rate × capture rate ÷ price, growing with volume", () => {
    const input = feeChainInput(seed, 36, { volumeGrowth: 0.05, feeRate: 0.001, captureRate: 0.4, priceMultiple: 2 });
    /** $5B × 0.1% × 40% ÷ ($2 × 2). */
    assertClose(input.boughtNearPerMonth, 500_000);
    assert.deepEqual({ ...input, boughtNearPerMonth: 0 }, { ...seedInput(seed, 36, 2), buybackGrowth: 0.05, boughtNearPerMonth: 0 });
  });

  test("equals seedInput at the seed's own rates, price and no growth", () => {
    const input = feeChainInput(seed, 36, { volumeGrowth: 0, feeRate: 0.001, captureRate: 0.4, priceMultiple: 1 });
    assertClose(input.boughtNearPerMonth, seed.boughtNearPerMonth);
    assert.deepEqual({ ...input, boughtNearPerMonth: 0 }, { ...seedInput(seed, 36), boughtNearPerMonth: 0 });
  });
});

describe("projectedVolumeUsd", () => {
  test("starts at the seed's monthly volume and compounds each month", () => {
    const volumes = projectedVolumeUsd(seed, 3, 0.1);
    assert.equal(volumes.length, 3);
    assertClose(volumes[0], 5e9);
    assertClose(volumes[1], 5.5e9);
    assertClose(volumes[2], 6.05e9);
    assert.deepEqual(projectedVolumeUsd(seed, 2, -0.5), [5e9, 2.5e9]);
    assert.deepEqual(projectedVolumeUsd(seed, 0, 0.1), []);
  });
});

describe("growthTerms", () => {
  test("returns the yearly rate and the multiple over the months", () => {
    const terms = growthTerms(0.1, 3);
    assertClose(terms.perYear, 1.1 ** 12 - 1);
    assertClose(terms.multiple, 1.331);
    assert.deepEqual(growthTerms(0, 36), { perYear: 0, multiple: 1 });
    assert.deepEqual(growthTerms(-0.5, 2), { perYear: 0.5 ** 12 - 1, multiple: 0.25 });
  });
});

describe("valuationScenarios", () => {
  test("adds the growth needed and the 90-day pace to the no-growth scenario", () => {
    const scenarios = valuationScenarios(seed, holdingMetrics());
    assert.deepEqual(
      scenarios.map(({ id, name, growth, growthMonths }) => ({ id, name, growth, growthMonths })),
      [
        { id: "no-growth", name: "No growth", growth: 0, growthMonths: 0 },
        { id: "growth-needed", name: "Growth needed", growth: 0.0506, growthMonths: COVERAGE_HORIZON_MONTHS - 1 },
        { id: "recent-pace", name: `90-day pace for ${RECENT_PACE_MONTHS} months`, growth: 0.199, growthMonths: RECENT_PACE_MONTHS },
      ],
    );
    assert.ok(scenarios.every((scenario) => scenario.rows.length === COVERAGE_HORIZON_MONTHS));
  });

  test("grows the 90-day pace scenario for its months, then holds NEAR bought flat", () => {
    const rows = valuationScenarios(seed, holdingMetrics()).find((scenario) => scenario.id === "recent-pace")!.rows;
    assertClose(rows[RECENT_PACE_MONTHS]?.boughtNear, 1_000_000 * 1.199 ** RECENT_PACE_MONTHS);
    assertClose(rows.at(-1)?.boughtNear, 1_000_000 * 1.199 ** RECENT_PACE_MONTHS);
  });

  test("leaves out the growth needed while none is needed and the pace until it is measured", () => {
    const metrics = holdingMetrics();
    const ids = (change: Partial<{ required: number | null; pace: number | null }>) =>
      valuationScenarios(seed, {
        valuation: { ...metrics.valuation!, requiredMonthlyGrowth: change.required ?? null },
        buybacks: { ...metrics.buybacks!, monthlyGrowth: change.pace ?? null },
      }).map((scenario) => scenario.id);
    assert.deepEqual(ids({}), ["no-growth"]);
    assert.deepEqual(ids({ required: 0 }), ["no-growth"]);
    assert.deepEqual(ids({ required: -0.2, pace: -0.05 }), ["no-growth", "recent-pace"]);
    assert.deepEqual(valuationScenarios(seed, { valuation: null, buybacks: null }).map((scenario) => scenario.id), ["no-growth"]);
  });
});

describe("scenarioOutcome", () => {
  /** Month 1 covers 990 of 1,000 NEAR minted; month 2 buys 759 and burns 300 of 1,007 minted. */
  const scenario: CoverageScenario = {
    id: "growth-needed",
    name: "Growth needed",
    growth: 0.1,
    growthMonths: 2,
    rows: project({ ...base, boughtNearPerMonth: 690, buybackGrowth: 0.1 }),
  };

  test("returns the first month covered, the last month's coverage and the volume its buying needs", () => {
    const outcome = scenarioOutcome(scenario, seed, 3_000_000);
    assert.equal(outcome.reachedMonth, 2);
    assertClose(outcome.finalCoverage, (300 + 834.9) / 1014.07);
    /** 834.9 NEAR a month × 12 × $2 ÷ 0.04% of volume, against $3M × 365 ÷ 30. */
    assertClose(outcome.volumePerYearUsd, 50_094_000);
    assertClose(outcome.timesRunRate, 50_094_000 / 36_500_000);
    assertClose(outcome.perYear, 1.1 ** 12 - 1);
    assertClose(outcome.multiple, 1.21);
  });

  test("reads 1× the run rate without growth when the 30 days match the seed", () => {
    const noGrowth = valuationScenarios(seed, holdingMetrics())[0]!;
    const outcome = scenarioOutcome(noGrowth, seed, (seed.volumeUsdPerMonth * 30) / DAYS_PER_MONTH);
    assertClose(outcome.timesRunRate, 1);
    assert.equal(outcome.reachedMonth, null);
    assert.equal(outcome.perYear, 0);
    assert.equal(outcome.multiple, 1);
  });

  test("has no volume without a take rate and no multiple without 30-day volume", () => {
    assert.equal(scenarioOutcome(scenario, { ...seed, takeRate: null }, 3_000_000).volumePerYearUsd, null);
    assert.equal(scenarioOutcome(scenario, { ...seed, takeRate: 0 }, 3_000_000).timesRunRate, null);
    assert.equal(scenarioOutcome(scenario, seed, 0).timesRunRate, null);
  });

  test("reads no coverage and no month reached for a scenario without months", () => {
    const outcome = scenarioOutcome({ ...scenario, rows: [] }, seed, 3_000_000);
    assert.equal(outcome.reachedMonth, null);
    assert.equal(outcome.finalCoverage, 0);
    assert.equal(outcome.volumePerYearUsd, 0);
  });
});
