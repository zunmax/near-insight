/** Queries behind the panels on /dashboard/home. */
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import type { NamedQuery } from "./named-query.ts";

export const HOME_QUERIES: NamedQuery[] = [
  {
    id: "near-market",
    title: "NEAR market and network state",
    page: "/dashboard/home",
    sentence:
      "NEAR's latest price, market cap, rank, FDV, circulating supply and 1-year price change. Beside them, the latest network state: total supply, max issuance rate, gas price, protocol version, block-producer seats and minimum stake ratio.",
    sql: `SELECT c.price_usd, c.market_cap_usd, c.rank, c.fdv_usd, c.circulating_supply, c.change_1y / 100 AS change_1y, c.fetched_at AS market_at,
  n.total_supply_near, n.max_inflation_rate, n.gas_price_yocto, n.protocol_version, n.block_producer_seats, n.minimum_stake_ratio,
  n.fetched_at AS network_at
FROM coins_latest c, network_latest n
WHERE c.coin_id = 'near'`,
    requests: [SOURCE_REQUESTS.markets, SOURCE_REQUESTS.protocolConfig, SOURCE_REQUESTS.block],
  },
  {
    id: "near-price",
    title: "NEAR price",
    page: "/dashboard/home",
    sentence:
      "NEAR's daily USD price at 00:00 UTC; today's row is the live price. The 12-month change is the newest price against the price 365 days earlier.",
    sql: `SELECT day, value AS price_usd
FROM daily_series
WHERE series = '${SERIES.nearPriceUsd}'
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.nearPrice, SOURCE_REQUESTS.markets],
    code: "src/lib/metrics.ts · levelChange",
  },
];
