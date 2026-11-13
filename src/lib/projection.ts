/** Pure month-by-month projection of NEAR issuance against fee burn and Intents buybacks, all in NEAR. */

import { COVERAGE_HORIZON_MONTHS, RECENT_PACE_MONTHS } from "@/config/projections";
import { FULL_BURN_PROTOCOL, HSP029 } from "@/config/protocol";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { formatCount } from "@/lib/format";
import { DAY_SECONDS, DAYS_PER_MONTH } from "@/lib/metrics";

/** Live starting values of every projection, from the last 30 days as amounts a month. The projections hold today's price. */
export type ProjectionSeed = {
  priceUsd: number;
  totalSupplyNear: number;
  maxInflationRate: number;
  /** NEAR the last 30 days' buyback dollars buy at today's price, a month. */
  boughtNearPerMonth: number;
  /** Gas fees paid in NEAR (each day's fees at that day's price), before the burn share. */
  feesNearPerMonth: number;
  /** Measured share of those fees burned: NEAR burned (block headers) ÷ gas fees in NEAR over the same 30 days. */
  measuredBurnShare: number;
  /** True once mainnet pays no gas to contracts (`burnt_gas_reward` 0), so every gas fee is burned. */
  fullBurn: boolean;
  /** Share of fees the projections burn: 1 under `fullBurn`, otherwise the measured share. */
  burnShareOfFees: number;
  /** Share of Intents volume that buys NEAR (buyback dollars ÷ volume) over the same 30 days, to show the volume a scenario needs. */
  takeRate: number | null;
  /** NEAR Intents volume (USD) over the same 30 days, as a monthly amount. */
  volumeUsdPerMonth: number;
  /** NEAR Intents fees ÷ volume over the 30 days to the last full day of fees; null while a day of fees is missing. */
  feeRate: number | null;
  /** `takeRate` ÷ `feeRate`, the share of fees that buys NEAR, so the fee chain starts from `boughtNearPerMonth`; null without a fee rate. */
  captureRate: number | null;
  /** HSP-029's ramp as seen from `through`: months until it starts (its grace period after the vote's timelock ends), the
      ramp months still to run, and the UTC time it starts (ISO 8601; null while the vote has no timelock end). */
  hsp029Ramp: { delayMonths: number; months: number; startsAt: string | null };
  /** Last day of the data behind these values (YYYY-MM-DD). */
  through: string;
};

/** "; all are burned since protocol 87" while mainnet burns every gas fee but the measured 30 days still hold days from before. */
export const measuredBurnNote = (seed: ProjectionSeed | null) =>
  seed?.fullBurn && seed.measuredBurnShare < 1 ? `; all are burned since protocol ${FULL_BURN_PROTOCOL}` : "";

export type ProjectionInput = {
  totalSupplyNear: number;
  /** Max issuance today, e.g. 0.025. */
  maxInflationRate: number;
  /** Target max issuance if HSP-029 passes (0.016), or null to keep today's rate. */
  targetInflationRate: number | null;
  /** Months before the HSP-029 ramp starts, and months the ramp takes. */
  rampDelayMonths: number;
  rampMonths: number;
  /** NEAR bought and gas fees paid in the first month. */
  boughtNearPerMonth: number;
  feesNearPerMonth: number;
  burnShareOfFees: number;
  /** Monthly growth rates, e.g. 0.05 for +5% a month. */
  buybackGrowth: number;
  feeGrowth: number;
  /** Months buybacks keep growing before they hold flat; every month when omitted. */
  buybackGrowthMonths?: number;
  months: number;
};

type ProjectionMonth = {
  month: number;
  issuanceRate: number;
  issuanceNear: number;
  burnedNear: number;
  boughtNear: number;
  /** Burned plus bought NEAR as a share of the month's issuance. */
  coverage: number;
  /** Total supply after the month: issuance added, burn removed. Bought NEAR is not burned, so it stays in total supply. */
  supplyNear: number;
  /** Total supply less all the NEAR bought so far: what burn and buybacks can still take, 0 once they have taken it all. */
  availableNear: number;
};

/** Average length of a month in seconds, for placing projected months on a time axis. */
export const MONTH_SECONDS = DAYS_PER_MONTH * DAY_SECONDS;

/** HSP-029's ramp from `throughTime` (unix seconds): it starts HSP029.graceDays after the vote's timelock ends. Once it has
    started, the projection ramps from today's rate over the months left; without a valid timelock end, a full grace period from `throughTime`. */
export function hsp029Ramp(timelockEndsAt: string | null, throughTime: number): ProjectionSeed["hsp029Ramp"] {
  const endsAt = timelockEndsAt === null ? Number.NaN : Date.parse(timelockEndsAt);
  if (Number.isNaN(endsAt)) return { delayMonths: HSP029.graceDays / DAYS_PER_MONTH, months: HSP029.rampMonths, startsAt: null };
  const start = endsAt / 1000 + HSP029.graceDays * DAY_SECONDS;
  const delay = (start - throughTime) / MONTH_SECONDS;
  return {
    delayMonths: Math.max(0, delay),
    months: Math.max(0, HSP029.rampMonths + Math.min(0, delay)),
    startsAt: new Date(start * 1000).toISOString(),
  };
}

/** Input that starts from the seed: today's issuance, burn share and 30-day amounts, with no growth. At `priceMultiple`
    times today's price the same buyback dollars buy proportionally less NEAR; the burn is unchanged, as gas is paid in NEAR. */
export function seedInput(seed: ProjectionSeed, months: number, priceMultiple = 1): ProjectionInput {
  return {
    totalSupplyNear: seed.totalSupplyNear,
    maxInflationRate: seed.maxInflationRate,
    targetInflationRate: null,
    rampDelayMonths: seed.hsp029Ramp.delayMonths,
    rampMonths: seed.hsp029Ramp.months,
    boughtNearPerMonth: seed.boughtNearPerMonth / priceMultiple,
    feesNearPerMonth: seed.feesNearPerMonth,
    burnShareOfFees: seed.burnShareOfFees,
    buybackGrowth: 0,
    feeGrowth: 0,
    months,
  };
}

export function project(input: ProjectionInput): ProjectionMonth[] {
  const rows: ProjectionMonth[] = [];
  let supply = input.totalSupplyNear;
  /** NEAR neither burned nor bought yet. Bought NEAR stays in the fee wallets, so it is never burned or bought again. */
  let available = input.totalSupplyNear;
  for (let m = 1; m <= input.months; m++) {
    /** Without ramp months left, the target rate applies from the first month after the delay. */
    const ramp = input.rampMonths > 0 ? (m - input.rampDelayMonths) / input.rampMonths : m > input.rampDelayMonths ? 1 : 0;
    const rampProgress = input.targetInflationRate === null ? 0 : Math.min(1, Math.max(0, ramp));
    const rate = input.maxInflationRate + ((input.targetInflationRate ?? input.maxInflationRate) - input.maxInflationRate) * rampProgress;
    const issuanceNear = (supply * rate) / 12;
    available += issuanceNear;
    /** The burn, then the buying, can take only the NEAR still available. */
    const burnedNear = Math.min(available, input.feesNearPerMonth * input.burnShareOfFees * (1 + input.feeGrowth) ** (m - 1));
    available -= burnedNear;
    const boughtNear = Math.min(available, input.boughtNearPerMonth * (1 + input.buybackGrowth) ** Math.min(m - 1, input.buybackGrowthMonths ?? Infinity));
    available -= boughtNear;
    supply = supply + issuanceNear - burnedNear;
    /** A month that mints nothing leaves nothing unabsorbed, and one that takes all NEAR left takes at least all it minted;
        both count as fully covered, free of division by zero and float noise. */
    const share = issuanceNear > 0 ? (burnedNear + boughtNear) / issuanceNear : 1;
    const coverage = available === 0 ? Math.max(1, share) : share;
    rows.push({ month: m, issuanceRate: rate, issuanceNear, burnedNear, boughtNear, coverage, supplyNear: supply, availableNear: available });
  }
  return rows;
}

/** Monthly growth of NEAR bought at which burn plus buybacks cover issuance in the last projected month, by bisection; burn keeps
    the input's fee growth (none from a seed). Negative when they already cover it: the steepest fall that still does, −1 when burn
    alone does (also with nothing bought). Null when nothing is bought and burn alone falls short, or no growth up to the ceiling does. */
export function coveringGrowth(input: ProjectionInput): number | null {
  const finalCoverage = (growth: number) => project({ ...input, buybackGrowth: growth, buybackGrowthMonths: undefined }).at(-1)?.coverage ?? 0;
  /** Tested with nothing bought rather than a growth of −1, which leaves month 1's buying in place (0⁰ = 1). */
  const burnAloneCovers = (project({ ...input, boughtNearPerMonth: 0 }).at(-1)?.coverage ?? 0) >= 1;
  if (input.boughtNearPerMonth <= 0) return burnAloneCovers ? -1 : null;
  if (finalCoverage(0) >= 1) {
    if (burnAloneCovers) return -1;
    let fall = -1;
    let holds = 0;
    for (let i = 0; i < 50; i++) {
      const mid = (fall + holds) / 2;
      if (finalCoverage(mid) >= 1) holds = mid;
      else fall = mid;
    }
    return holds;
  }
  let low = 0;
  let high = 1;
  for (let i = 0; i < 10 && finalCoverage(high) < 1; i++) high *= 2;
  /** No growth up to the search's ceiling covers issuance: there is no growth to report. */
  if (finalCoverage(high) < 1) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (finalCoverage(mid) < 1) low = mid;
    else high = mid;
  }
  return high;
}

/** How NEAR Intents volume turns into NEAR bought in the fee-chain projection. */
type FeeChainAssumptions = {
  /** Monthly growth of NEAR Intents volume, e.g. 0.05 for +5% a month. */
  volumeGrowth: number;
  /** NEAR Intents fees ÷ volume. */
  feeRate: number;
  /** Share of those fees that buys NEAR. */
  captureRate: number;
  /** NEAR price as a multiple of today's. */
  priceMultiple: number;
};

/** Input in which NEAR bought follows NEAR Intents volume: the seed's monthly volume × fee rate × the share that buys NEAR ÷
    the price, growing with volume every month. At the seed's own rates, price and no growth it equals `seedInput`. */
export function feeChainInput(seed: ProjectionSeed, months: number, assumptions: FeeChainAssumptions): ProjectionInput {
  const { volumeGrowth, feeRate, captureRate, priceMultiple } = assumptions;
  return {
    ...seedInput(seed, months, priceMultiple),
    boughtNearPerMonth: (seed.volumeUsdPerMonth * feeRate * captureRate) / (seed.priceUsd * priceMultiple),
    buybackGrowth: volumeGrowth,
  };
}

/** NEAR Intents volume (USD) in each projected month at `volumeGrowth` a month, month 1 being the seed's month. */
export function projectedVolumeUsd(seed: ProjectionSeed, months: number, volumeGrowth: number): number[] {
  return Array.from({ length: months }, (_, i) => seed.volumeUsdPerMonth * (1 + volumeGrowth) ** i);
}

export type CoverageScenario = {
  id: "no-growth" | "growth-needed" | "recent-pace";
  name: string;
  /** Monthly growth of NEAR bought, and the months it applies before holding flat. */
  growth: number;
  growthMonths: number;
  rows: ProjectionMonth[];
};

/** The Valuation scenarios over `months`, the burn held at today's pace in each: no growth; NEAR bought growing at `needed`
    (left out while none is needed or none can help, null); NEAR bought changing at the 90-day pace `recent` for `recentMonths`,
    then flat (left out until that pace is measured, null). */
function coverageScenarios(seed: ProjectionSeed, months: number, needed: number | null, recent: number | null, recentMonths: number): CoverageScenario[] {
  const base = seedInput(seed, months);
  const scenarios: CoverageScenario[] = [{ id: "no-growth", name: "No growth", growth: 0, growthMonths: 0, rows: project(base) }];
  if (needed !== null && needed > 0) {
    scenarios.push({ id: "growth-needed", name: "Growth needed", growth: needed, growthMonths: months - 1, rows: project({ ...base, buybackGrowth: needed }) });
  }
  if (recent !== null) {
    scenarios.push({
      id: "recent-pace",
      name: `90-day pace for ${formatCount(recentMonths, "month")}`,
      growth: recent,
      growthMonths: recentMonths,
      rows: project({ ...base, buybackGrowth: recent, buybackGrowthMonths: recentMonths }),
    });
  }
  return scenarios;
}

/** The Valuation scenarios over COVERAGE_HORIZON_MONTHS from the thesis metrics: the growth needed and NEAR bought's 90-day pace. */
export function valuationScenarios(seed: ProjectionSeed, { buybacks, valuation }: Pick<ThesisMetrics, "buybacks" | "valuation">): CoverageScenario[] {
  return coverageScenarios(seed, COVERAGE_HORIZON_MONTHS, valuation?.requiredMonthlyGrowth ?? null, buybacks?.monthlyGrowth ?? null, RECENT_PACE_MONTHS);
}

/** What a monthly growth rate means over a scenario: the yearly rate and the total increase over `months`. */
export function growthTerms(monthlyGrowth: number, months: number): { perYear: number; multiple: number } {
  return { perYear: (1 + monthlyGrowth) ** 12 - 1, multiple: (1 + monthlyGrowth) ** months };
}

/** A scenario's yearly Intents volume as a multiple of today's run rate (the last 30 days, annualized), the same 30 days
    its share of volume that buys NEAR comes from, so a scenario without growth reads 1×; null without volume in those 30 days. */
function timesVolumeRunRate(volumePerYearUsd: number, volume30dUsd: number): number | null {
  return volume30dUsd > 0 ? volumePerYearUsd / ((volume30dUsd * 365) / 30) : null;
}

/** Yearly Intents volume (USD) that buys `boughtNearPerMonth` at the seed's price and share of volume that buys NEAR; null without one. */
function impliedVolumePerYearUsd(boughtNearPerMonth: number, seed: ProjectionSeed): number | null {
  return seed.takeRate ? (boughtNearPerMonth * 12 * seed.priceUsd) / seed.takeRate : null;
}

/** A scenario's result: the first month burn plus buybacks reach issuance (null if none), the share absorbed in its last month,
    the yearly Intents volume that month's buying needs and its multiple of the 30-day run rate, and its growth terms. */
export function scenarioOutcome(scenario: CoverageScenario, seed: ProjectionSeed, volume30dUsd: number) {
  const last = scenario.rows.at(-1);
  const volumePerYearUsd = impliedVolumePerYearUsd(last?.boughtNear ?? 0, seed);
  return {
    reachedMonth: scenario.rows.find((row) => row.coverage >= 1)?.month ?? null,
    finalCoverage: last?.coverage ?? 0,
    volumePerYearUsd,
    timesRunRate: volumePerYearUsd === null ? null : timesVolumeRunRate(volumePerYearUsd, volume30dUsd),
    ...growthTerms(scenario.growth, scenario.growthMonths),
  };
}
