/** Settings of the lead-lag test (src/lib/lead-lag.ts): does weekly growth in NEAR Intents volume lead NEAR's price or
    NEAR usage? Fixed in advance so every run of the test is the same test. */
export const LEAD_LAG = {
  /** The sample starts at the first week with at least this much Intents volume, so tiny launch weeks do not dominate. */
  minWeeklyVolumeUsd: 25_000_000,
  /** Largest lead or lag tested, in weeks. */
  maxLagWeeks: 4,
  /** Average length, in weeks, of the blocks a bootstrap draw is built from, so each draw keeps a series' short-term pattern. */
  meanBlockWeeks: 4,
  /** Bootstrap draws behind each p-value: the smallest p is 1 ÷ (draws + 1), small enough to survive the Holm correction. */
  nullDraws: 9_999,
  /** Seed of the draws, so every run of the test gives the same p-values. */
  seed: 20_260_223,
  /** Significance level, applied after the Holm correction across every test. */
  alpha: 0.05,
  /** Fewest aligned weeks the test runs on; with fewer the result is not shown. */
  minWeeks: 26,
} as const;
