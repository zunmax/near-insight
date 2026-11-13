/** Queries behind the charts on /dashboard/peers. */
import { PEER_SUPPLY_GROWTH } from "../../config/peers.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import type { NamedQuery } from "./named-query.ts";

const { minHistoryDays, endDays } = PEER_SUPPLY_GROWTH;

export const PEER_QUERIES: NamedQuery[] = [
  {
    id: "peer-supply-growth",
    title: "Circulating supply growth, 12 months",
    page: "/dashboard/peers",
    sentence:
      `Circulating supply growth of NEAR and every coin ranked above it: the median supply of the newest ${endDays} days against the median of the ${endDays} days ending 365 days earlier (or the first ${endDays} stored days when history is shorter), as a yearly rate. Medians stop a single wrong reading from moving the result; coins with less than ${minHistoryDays} days of history are left out.`,
    sql: `WITH bounds AS (
  SELECT coin_id, MIN(day) AS first_day, MAX(day) AS last_day FROM coin_supply_daily GROUP BY coin_id),
ends AS (
  SELECT coin_id, last_day,
    CASE WHEN first_day <= date(last_day, '-365 days', '-${endDays - 1} days') THEN date(last_day, '-365 days') ELSE date(first_day, '+${endDays - 1} days') END AS base_day
  FROM bounds
  WHERE julianday(last_day) - julianday(first_day) >= ${minHistoryDays}),
windowed AS (
  SELECT e.coin_id, e.last_day, e.base_day, CASE WHEN s.day > date(e.last_day, '-${endDays} days') THEN 'now' ELSE 'base' END AS side, s.circulating_supply AS supply
  FROM ends e JOIN coin_supply_daily s ON s.coin_id = e.coin_id
  WHERE s.day > date(e.last_day, '-${endDays} days') OR (s.day > date(e.base_day, '-${endDays} days') AND s.day <= e.base_day)),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY coin_id, side ORDER BY supply) AS rn, COUNT(*) OVER (PARTITION BY coin_id, side) AS n
  FROM windowed),
medians AS (
  SELECT coin_id, last_day, base_day, side, AVG(supply) AS supply
  FROM ranked
  WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
  GROUP BY coin_id, side)
SELECT c.rank, c.coin_id, c.symbol, now.last_day AS day, now.base_day, julianday(now.last_day) - julianday(now.base_day) AS span_days,
  now.supply AS supply_now_median, base.supply AS supply_base_median,
  pow(now.supply / base.supply, 365.0 / (julianday(now.last_day) - julianday(now.base_day))) - 1 AS growth_1y
FROM medians now
JOIN medians base ON base.coin_id = now.coin_id AND base.side = 'base'
JOIN coins_latest c ON c.coin_id = now.coin_id
WHERE now.side = 'now' AND c.rank <= (SELECT rank FROM coins_latest WHERE coin_id = 'near')
ORDER BY c.rank`,
    requests: [SOURCE_REQUESTS.peerSupply, SOURCE_REQUESTS.markets],
    code: "src/data/market.ts · getSupplyGrowth1y; src/lib/metrics.ts · yearlyGrowthOfMedians",
  },
  {
    id: "peer-markets",
    title: "The coins ranked above NEAR",
    page: "/dashboard/peers",
    sentence:
      "The latest price, market cap and FDV of NEAR and every coin ranked above it, with FDV ÷ market cap (1 when CoinGecko gives no FDV), the price change over a year and the distance from the all-time high.",
    sql: `SELECT rank, coin_id, symbol, price_usd, market_cap_usd, fdv_usd, COALESCE(fdv_usd, market_cap_usd) / market_cap_usd AS fdv_to_market_cap,
  change_1y / 100 AS change_1y, price_usd / ath_usd - 1 AS from_ath, fetched_at
FROM coins_latest
WHERE rank <= (SELECT rank FROM coins_latest WHERE coin_id = 'near')
ORDER BY rank`,
    requests: [SOURCE_REQUESTS.markets],
  },
];
