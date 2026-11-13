/** Thresholds of each thesis's breaking point (checked in src/lib/thesis/triggers.ts). They are fixed in advance, so
    every reading of the data runs the same check. */
export const TRIGGERS = {
  /** Max issuance after the October 2025 halving; a higher rate counts as issuance raised again. */
  maxIssuanceCeiling: 0.025,
  /** Cost of a simple NEAR transfer, in USD, above which fees no longer count as low. */
  transferCostLimitUsd: 0.01,
  /** Fewest validators that may together hold a third of all stake; fewer counts as control concentrating. */
  nakamotoFloor: 8,
  /** Largest daily gap, as a share of the NEAR bought over 30 days, between the NEAR bought since the window began and what
      the three fee wallets gained since then; a larger gap counts as NEAR sold or moved out. Price conversion alone leaves about 1%. */
  walletShortfallShare: 0.05,
} as const;

/** Range of the monthly growth of NEAR bought (src/lib/bootstrap.ts `windowGrowthRange`): the share it covers, and stationary
    block bootstraps of each 90-day window's days in blocks of a week on average. Seeded, so every run gives the same range. */
export const BOUGHT_GROWTH_RANGE = { level: 0.95, meanBlock: 7, draws: 9_999, seed: 20_260_223 } as const;

/** Levels at which a finding's number counts as evidence for its section's claim (src/lib/thesis/findings.ts). */
export const FINDING_LEVELS = {
  /** NEAR Intents share of DEX volume on NEAR from which Intents is most of the trading there. */
  dexShareMajority: 0.5,
  /** Share of NEAR Intents fees buying NEAR from which most of the fees go to buybacks. */
  captureRateMajority: 0.5,
} as const;
