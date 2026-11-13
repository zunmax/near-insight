/** Projection month in which burn plus buybacks must match that month's issuance (growth needed, scenarios, valuation breaking point). */
export const COVERAGE_HORIZON_MONTHS = 36;

/** Months the 90-day pace scenario grows NEAR bought at its measured monthly pace (90 days against the 90 before), then holds it flat. */
export const RECENT_PACE_MONTHS = 12;

/** Months of the total-supply outlook on the Supply page. */
export const SUPPLY_OUTLOOK_MONTHS = 60;

/** Prices (multiples of today's) and horizons (months) of the growth needed in the "What the price assumes" panel on Valuation. */
export const REQUIREMENT_PRICE_MULTIPLES = [0.5, 1, 2, 4] as const;
export const REQUIREMENT_HORIZON_MONTHS = [24, 36, 60] as const;
