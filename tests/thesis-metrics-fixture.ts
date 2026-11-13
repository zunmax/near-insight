/** A full ThesisMetrics close to the committed snapshot's numbers, but with every breaking point holding, for the thesis tests;
    each test changes only the fields its case needs. */
import assert from "node:assert/strict";
import type { ThesisMetrics } from "../src/data/thesis-metrics.ts";
import type { Absorption } from "../src/lib/metrics.ts";
import { dataCheck, dayTime } from "../src/lib/metrics.ts";

export const DATA_THROUGH = "2026-11-09";

/** No undefined, NaN or empty value printed into a sentence. */
export function assertWellFormed(text: string) {
  assert.doesNotMatch(text, /undefined|NaN|Infinity|null|\[object/);
  assert.doesNotMatch(text, /(to|of|on) —/);
}

/** Burn plus buybacks as `share` of 1M NEAR minted over `days`, a tenth of it burned. */
export function absorbed(days: number, share: number): Absorption {
  const mintedNear = 1_000_000;
  return { days, mintedNear, burntNear: mintedNear * share * 0.1, burntShare: share * 0.1, boughtShare: share * 0.9, share };
}

export function holdingMetrics(): ThesisMetrics {
  return {
    market: { priceUsd: 3.62, marketCapUsd: 4.75e9, rank: 21, fdvRatio: 1 },
    supply: { totalSupplyNear: 1.311e9, maxInflationRate: 0.025, growth1y: 0.0248, growthThrough: "2026-11-11", burnShareOfFees: 1 },
    staking: {
      stakedShare: 0.444,
      grossYield: 0.05,
      realYield: 0.0251,
      validators: 351,
      nakamoto: 9,
      chunkValidatorSeatNear: 9_300,
      blockProducerSeatNear: 635_800,
      producers: 100,
      epochHeight: 4958,
    },
    dataThrough: DATA_THROUGH,
    flowsCurrent: true,
    readAt: "2026-11-11T08:07:00.000Z",
    seed: {
      priceUsd: 3.62,
      totalSupplyNear: 1.311e9,
      maxInflationRate: 0.025,
      boughtNearPerMonth: 514_800,
      feesNearPerMonth: 33_800,
      measuredBurnShare: 0.816,
      fullBurn: true,
      burnShareOfFees: 1,
      takeRate: 0.00041,
      volumeUsdPerMonth: 4.54e9,
      feeRate: 0.00156,
      captureRate: 0.263,
      hsp029Ramp: { delayMonths: 3, months: 24, startsAt: "2027-02-14T16:48:00.000Z" },
      through: DATA_THROUGH,
    },
    issuance: { measuredFrom: "2025-10-01", minted30dNear: 2.7e6, rate30d: 0.0249, minted1yNear: 32.2e6, rate1y: 0.0252 },
    absorption: {
      d30: absorbed(30, 0.161),
      d90: absorbed(90, 0.194),
      d90Prior: absorbed(90, 0.116),
      sinceBuybacks: absorbed(260, 0.152),
      d365: absorbed(365, 0.117),
      monthly: [],
      monthlyThrough: DATA_THROUGH,
    },
    intents: {
      total30d: 3.73e9,
      change90d: 0.73,
      total90d: 12.37e9,
      prior90d: 7.17e9,
      yearAgo30d: 2.33e9,
      changeYoY30d: 0.6,
      total1y: 33.83e9,
      duneThrough: DATA_THROUGH,
      swaps30d: 1.84e6,
      swapsYearAgo30d: 2.45e6,
      swapsChangeYoY30d: -0.25,
      avgSwapUsd30d: 2030,
      avgSwapUsdYearAgo30d: 951.45,
      confidentialShare30d: 0.563,
      confidentialShare30dPrior90d: 0.5,
    },
    intentsTvl: null,
    buybacks: {
      total30dUsd: 1.84e6,
      bought30dNear: 403_800,
      change90d: 0.71,
      bought90dNear: 1.48e6,
      boughtPrior90dNear: 862_950,
      monthlyGrowth: 0.199,
      monthlyGrowthRange: { low: 0.096, high: 0.313 },
      boughtNearTotal: 3.3e6,
      monthlyNear: [],
      takeRate90d: 0.00041,
      takeRatePrior90d: 0.00024,
    },
    valuation: { marketCapUsd: 4.75e9, tokenRevenueRunRateUsd: 18.98e6, multiple: 250, holderYield: 0.004, requiredMonthlyGrowth: 0.0506 },
    feeChain: null,
    dexShare: null,
    intentsTxnShare: null,
    intentsReach: null,
    activity: null,
    feeWallets: {
      asOf: "2026-11-11",
      buybackNear: 2.2e6,
      frontendNear: 2e6,
      oneClickNear: 270.9,
      totalNear: 4.2e6,
      gain30dNear: 406_600,
      gainThrough: DATA_THROUGH,
      bought30dNear: 403_800,
      shortfall30dNear: 2_000,
    },
    breakEven: { d30: { multiple: 6.22, volumePerDayUsd: 649.68e6, currentVolumePerDayUsd: 124.26e6 }, d90: null },
    dataChecks: {
      txnFees: null,
      burnShare: null,
      totalSupply: null,
      boughtVsWallets: dataCheck(403_800, 406_600, 30, dayTime(DATA_THROUGH)),
      revenueMultiple: null,
      treasuryShare: null,
    },
    treasury: null,
    revenueMultiple: null,
    hsp029: {
      contract: "vote.dao",
      proposalId: 29,
      title: "HSP-029",
      status: "Timelock",
      venearFor: 9_997,
      venearAgainst: 3,
      venearAbstain: 0,
      venearSnapshot: 20_000,
      voters: 120,
      quorumThresholdBps: 3500,
      approvalThresholdBps: 5000,
      votingEndsAt: "2026-11-09T16:48:00.000Z",
      timelockEndsAt: "2026-11-16T16:48:00.000Z",
      shareFor: 0.9997,
      fetchedAt: "2026-11-11T08:00:00.000Z",
    },
    leadLag: null,
    protocol: { mainnet: 88, testnet: 88, fetchedAt: "2026-11-11T08:00:00.000Z" },
    technology: { transferCostNear: 0.0000446, transferCostUsd: 0.000161, gasPriceReadAt: "2026-11-11T08:07:00.000Z" },
    peers: {
      through: "2026-11-11",
      nearGrowth1y: 0.018,
      medianGrowth1y: 0.021,
      count: 15,
      fasterCount: 9,
      lockedCount: 8,
      peerTotal: 15,
      nearFdvRatio: 1,
      nearLocked: false,
    },
  };
}
