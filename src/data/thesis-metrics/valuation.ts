/** Projection seed, token-revenue valuation, issuance break-even and market cap ÷ network revenue. */
import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { breakEven, coversWindow, DAY_SECONDS, dayTime, firstFullMonthStart, median, ratio, revenueMultiple, sumByDay, sumWindow, type DailyPoint } from "@/lib/metrics";
import { coveringGrowth, hsp029Ramp, seedInput, type ProjectionSeed } from "@/lib/projection";
import { proposalFailed } from "@/lib/thesis/proposal-status";
import { feesEnd, type FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

export function seedMetrics(inputs: ThesisInputs, flow: FlowContext): ProjectionSeed | null {
  const { market, network, burnt, hsp029, buybacks, volume, intentsFees } = inputs;
  const { throughDay, covered, sum, feesNear } = flow;
  const feesThrough = feesEnd(inputs, flow);
  const near = market?.near;
  /** Measured burn share: NEAR burned ÷ gas fees in NEAR over the same 30 days. */
  const measuredBurnShare = covered(burnt, 30) && covered(feesNear, 30) ? ratio(sum(burnt, 30), sum(feesNear, 30)) : null;
  const perMonth = (daily: DailyPoint[]) => (sum(daily, 30) * 365) / 30 / 12;
  /** Every starting value is a 30-day sum, so each of its series must have every day of the window. */
  const startCovered = covered(buybacks, 30) && covered(volume, 30);
  const fullBurn = network?.burntGasShareToContracts === 0;
  const takeRate = ratio(sum(buybacks, 30), sum(volume, 30));
  /** Fees ÷ volume over the 30 days to the last full day of fees, which can be a day before the other starting values. */
  const feeRate =
    feesThrough > 0 && coversWindow(intentsFees, 30, 0, feesThrough) && coversWindow(volume, 30, 0, feesThrough)
      ? ratio(sumWindow(intentsFees, 30, 0, feesThrough), sumWindow(volume, 30, 0, feesThrough))
      : null;
  /** The projections divide by the price and by each month's issuance, so a price or supply of zero leaves no seed. */
  return near && near.priceUsd > 0 && network && network.totalSupplyNear > 0 && throughDay && measuredBurnShare !== null && startCovered
    ? {
        priceUsd: near.priceUsd,
        totalSupplyNear: network.totalSupplyNear,
        maxInflationRate: network.maxInflationRate,
        /** The projections hold today's price, so the buyback dollars are converted at it, the same price the volume a
            scenario needs is computed at; NEAR bought at each day's own price is the measured figure, not a starting value. */
        boughtNearPerMonth: perMonth(buybacks) / near.priceUsd,
        feesNearPerMonth: perMonth(feesNear),
        measuredBurnShare,
        fullBurn,
        /** With no gas paid to contracts every fee is burned; a 30-day share would still count days from before that rule. */
        burnShareOfFees: fullBurn ? 1 : measuredBurnShare,
        /** Buyback dollars ÷ volume over the same 30 days as every other starting value, and as break-even. */
        takeRate,
        volumeUsdPerMonth: perMonth(volume),
        feeRate,
        /** `takeRate` ÷ fee rate, so fee rate × capture rate buys the same NEAR the other projections start from. */
        captureRate: feeRate && takeRate !== null ? takeRate / feeRate : null,
        /** A vote that failed or was vetoed dates no ramp, so the HSP-029 option then assumes a full grace period from the
            data-through day. */
        hsp029Ramp: hsp029Ramp(hsp029 && !proposalFailed(hsp029) ? hsp029.timelockEndsAt : null, dayTime(throughDay)),
        through: throughDay,
      }
    : null;
}

export function valuationMetrics({ market, burnt }: ThesisInputs, { covered, sum, boughtNear }: FlowContext, seed: ProjectionSeed | null): ThesisMetrics["valuation"] {
  const near = market?.near;
  const runRateNear = covered(burnt, 30) && covered(boughtNear, 30) ? ((sum(burnt, 30) + sum(boughtNear, 30)) * 365) / 30 : null;
  return near && runRateNear !== null
    ? {
        marketCapUsd: near.marketCapUsd,
        tokenRevenueRunRateUsd: runRateNear * near.priceUsd,
        multiple: runRateNear > 0 ? near.marketCapUsd / (runRateNear * near.priceUsd) : null,
        holderYield: (runRateNear * near.priceUsd) / near.marketCapUsd,
        requiredMonthlyGrowth: seed ? coveringGrowth(seedInput(seed, COVERAGE_HORIZON_MONTHS)) : null,
      }
    : null;
}

export function breakEvenMetrics({ market, minted, burnt, volume, buybacks }: ThesisInputs, { through, sum, boughtNear, measured, covered }: FlowContext): ThesisMetrics["breakEven"] {
  const near = market?.near;
  const breakEvenOver = (days: number) =>
    near && measured(days) && covered(volume, days)
      ? breakEven({
          days,
          mintedNear: sum(minted, days),
          burntNear: sum(burnt, days),
          boughtNear: sum(boughtNear, days),
          volumeUsd: sum(volume, days),
          priceUsd: near.priceUsd,
          buybackRate: ratio(sum(buybacks, days), sum(volume, days)),
        })
      : null;
  return through !== null ? { d30: breakEvenOver(30), d90: breakEvenOver(90) } : null;
}

/** Network revenue: NEAR Intents revenue plus gas fees, on the days both are stored. */
export function networkRevenue({ intentsRevenue, fees }: ThesisInputs): DailyPoint[] {
  return sumByDay(intentsRevenue, fees);
}

/** Market cap ÷ network revenue, from the first 30-day window that starts on or after the first month with Intents revenue
    on every day: earlier revenue arrived in occasional lumps, which swung the multiple between about 120× and 1,500×
    (the same base rule as RevenueUnitsPanel). */
export function revenueMultipleMetrics({ marketCapHistory, intentsRevenue }: ThesisInputs, revenue: DailyPoint[]): ThesisMetrics["revenueMultiple"] {
  const from = firstFullMonthStart(intentsRevenue);
  const multiples = from === null ? [] : revenueMultiple(marketCapHistory, revenue, 30).filter((point) => point.time - 29 * DAY_SECONDS >= from);
  const multipleValues = multiples.map((point) => point.value);
  if (multiples.length === 0) return null;
  const latest = multiples.at(-1)!;
  const multipleMedian = median(multipleValues)!;
  const low = Math.min(...multipleValues);
  const high = Math.max(...multipleValues);
  /** The yearly revenue behind the latest multiple, the same 30 days × 365 ÷ 30. */
  const revenuePerYearUsd = (sumWindow(revenue, 30, 0, latest.time) * 365) / 30;
  return {
    daily: multiples,
    latest,
    median: multipleMedian,
    low,
    high,
    impliedMarketCapUsd: { low: low * revenuePerYearUsd, median: multipleMedian * revenuePerYearUsd, high: high * revenuePerYearUsd },
  };
}
