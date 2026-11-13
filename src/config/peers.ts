/** Circulating-supply growth of NEAR and the coins ranked above it (src/data/market.ts, the peer-supply-growth query). */
export const PEER_SUPPLY_GROWTH = {
  /** Least history, in days between the first and last stored supply, for a yearly growth figure. */
  minHistoryDays: 360,
  /** Days whose median supply each end of the yearly growth uses: one day of CoinGecko's supply can be about 1% off. */
  endDays: 7,
} as const;

/** FDV above market cap by more than this share counts as supply not yet circulating; smaller gaps are rounding between CoinGecko fields. */
export const LOCKED_SUPPLY_MARGIN = 0.01;

/** A dollar-pegged coin (stablecoin, or tokenized cash or credit fund whose price creeps up with its yield) is priced within
    PEG_PRICE_BAND of $1 and within PEG_CHANGE_1Y percent of its price a year earlier. Its supply follows deposits or lending,
    not issuance, so it is left out of the peer median and the count of coins with supply left to unlock. */
export const PEG_PRICE_BAND = 0.1;
export const PEG_CHANGE_1Y = 10;
