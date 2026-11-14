/** Queries behind the charts on /dashboard/usage. */
import { STABLECOIN_SQL_LIST } from "../../config/intents.ts";
import { LEAD_LAG } from "../../config/lead-lag.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import { DUNE_THROUGH, THROUGH, pivot } from "./fragments.ts";
import type { NamedQuery } from "./named-query.ts";

export const USAGE_QUERIES: NamedQuery[] = [
  {
    id: "intents-volume",
    title: "NEAR Intents volume, 30-day totals",
    page: "/dashboard/usage",
    sentence:
      "Daily NEAR Intents swap volume, public and confidential, with its 30-day running total. Each day uses Dune's value, or DefiLlama's when Dune has none. The chart takes every 30th total back from the data-through day.",
    sql: `WITH ${THROUGH}
SELECT d.day, d.value AS volume_usd,
  SUM(d.value) OVER (ORDER BY julianday(d.day) RANGE BETWEEN 29 PRECEDING AND CURRENT ROW) AS volume_30d_usd
FROM daily_series d, through t
WHERE d.series = '${SERIES.intentsVolumeUsd}' AND d.day <= t.day
ORDER BY d.day DESC`,
    requests: [SOURCE_REQUESTS.duneVolume, SOURCE_REQUESTS.intentsVolume],
    code: "src/ingest/jobs/merge-intents.ts · mergeIntentsFlows; src/lib/metrics.ts · rollingWindows",
  },
  {
    id: "intents-confidential",
    title: "Public and confidential NEAR Intents volume",
    page: "/dashboard/usage",
    sentence: "Daily NEAR Intents volume split into public and confidential swaps, with the confidential share, from the NEAR team's Dune dashboard.",
    sql: `WITH ${THROUGH}, ${DUNE_THROUGH}
SELECT p.day, volume_usd, volume_usd - confidential_usd AS public_usd, confidential_usd, confidential_usd / volume_usd AS confidential_share
FROM (${pivot({ volume_usd: SERIES.duneIntentsVolumeUsd, confidential_usd: SERIES.intentsConfidentialVolumeUsd })}) p, dune_through e
WHERE volume_usd > 0 AND confidential_usd IS NOT NULL AND p.day <= e.day
ORDER BY p.day DESC`,
    requests: [SOURCE_REQUESTS.duneVolume],
    code: "src/lib/metrics.ts · rollingWindows (7-day blocks)",
  },
  {
    id: "intents-tvl",
    title: "Funds held in NEAR Intents",
    page: "/dashboard/usage",
    sentence:
      "NEAR Intents TVL (funds held) by day, split into public and confidential balances, from the NEAR team's Dune dashboard. Confidential balances count as zero before they began, as on the chart.",
    sql: `WITH first_confidential AS (SELECT MIN(day) AS day FROM daily_series WHERE series = '${SERIES.intentsConfidentialTvlUsd}'),
split AS (
  SELECT p.day, p.tvl_usd, CASE WHEN p.confidential_usd IS NULL AND (f.day IS NULL OR p.day < f.day) THEN 0 ELSE p.confidential_usd END AS confidential_usd
  FROM (${pivot({ tvl_usd: SERIES.intentsTvlUsd, confidential_usd: SERIES.intentsConfidentialTvlUsd })}) p, first_confidential f)
SELECT day, tvl_usd, tvl_usd - confidential_usd AS public_usd, confidential_usd, confidential_usd / tvl_usd AS confidential_share
FROM split
WHERE tvl_usd > 0 AND confidential_usd IS NOT NULL
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.duneTvl],
  },
  {
    id: "intents-txn-share",
    title: "NEAR Intents share of NEAR transactions",
    page: "/dashboard/usage",
    sentence: "Daily transactions of intents.near (the NEAR Intents contract) against all NEAR transactions.",
    sql: `SELECT day, intents_txns, all_txns, 1.0 * intents_txns / all_txns AS share
FROM (${pivot({ intents_txns: SERIES.intentsTxns, all_txns: SERIES.nearTxns })})
WHERE intents_txns IS NOT NULL AND all_txns > 0
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.intentsTxns, SOURCE_REQUESTS.nearblocksDaily],
    code: "src/lib/metrics.ts · ratioByDay",
  },
  {
    id: "intents-dex-share",
    title: "NEAR Intents share of DEX volume on NEAR",
    page: "/dashboard/usage",
    sentence: "DefiLlama's Intents volume against the volume of every DEX DefiLlama tracks on NEAR, Intents included. Rows cover the 30 and 180 days to the data-through day and each calendar month through that day. Both come from DefiLlama, so they count the same swaps.",
    sql: `WITH ${THROUGH}, windows(days) AS (VALUES (30), (180))
SELECT 'last ' || w.days || ' days' AS month, COUNT(*) AS days,
  SUM(intents_usd) AS intents_volume_usd, SUM(dex_usd) AS dex_volume_usd, SUM(intents_usd) / SUM(dex_usd) AS share
FROM windows w, (${pivot({ intents_usd: SERIES.defillamaIntentsVolumeUsd, dex_usd: SERIES.nearDexVolumeUsd })}) p, through t
WHERE intents_usd IS NOT NULL AND dex_usd IS NOT NULL AND p.day > date(t.day, '-' || w.days || ' days') AND p.day <= t.day
GROUP BY w.days
HAVING COUNT(*) = w.days
UNION ALL
SELECT substr(p.day, 1, 7) AS month, COUNT(*) AS days,
  SUM(intents_usd) AS intents_volume_usd, SUM(dex_usd) AS dex_volume_usd, SUM(intents_usd) / SUM(dex_usd) AS share
FROM (${pivot({ intents_usd: SERIES.defillamaIntentsVolumeUsd, dex_usd: SERIES.nearDexVolumeUsd })}) p, through t
WHERE intents_usd IS NOT NULL AND dex_usd IS NOT NULL AND p.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.intentsVolume, SOURCE_REQUESTS.dexVolume],
  },
  {
    id: "lead-lag-weekly",
    title: "Lead-lag test inputs",
    page: "/dashboard/usage",
    sentence: `Weekly inputs of the lead-lag test, in 7-day blocks ending on the data-through day. Each block sums Intents volume, averages active accounts and takes prices at the close of its last day (the next day's 00:00 UTC price). The test starts at the first week with at least $${LEAD_LAG.minWeeklyVolumeUsd / 1e6}M of Intents volume, so earlier rows are shown but not tested. A series' value shows only for weeks it has all seven days; the test uses the newest run of consecutive weeks with every value.`,
    sql: `WITH ${THROUGH},
days AS (
  SELECT series, day, value, through_day, CAST((julianday(through_day) - julianday(day)) / 7 AS INTEGER) AS weeks_back
  FROM (
    SELECT d.series, d.value, t.day AS through_day,
      CASE WHEN d.series IN ('${SERIES.nearPriceHistoryUsd}', '${SERIES.btcPriceUsd}', '${SERIES.ethPriceUsd}') THEN date(d.day, '-1 day') ELSE d.day END AS day
    FROM daily_series d, through t
    WHERE d.series IN ('${SERIES.intentsVolumeUsd}', '${SERIES.nearPriceHistoryUsd}', '${SERIES.btcPriceUsd}', '${SERIES.ethPriceUsd}', '${SERIES.nearActiveAccounts}'))
  WHERE day <= through_day)
SELECT date(MAX(through_day), '-' || (weeks_back * 7) || ' days') AS week_end,
  SUM(CASE WHEN series = '${SERIES.intentsVolumeUsd}' THEN value END) AS intents_volume_usd,
  COUNT(CASE WHEN series = '${SERIES.intentsVolumeUsd}' THEN 1 END) AS volume_days,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.nearPriceHistoryUsd}' THEN 1 END) = 7 THEN
    MAX(CASE WHEN series = '${SERIES.nearPriceHistoryUsd}' AND day = date(through_day, '-' || (weeks_back * 7) || ' days') THEN value END) END AS near_price_usd,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.btcPriceUsd}' THEN 1 END) = 7 THEN
    MAX(CASE WHEN series = '${SERIES.btcPriceUsd}' AND day = date(through_day, '-' || (weeks_back * 7) || ' days') THEN value END) END AS btc_price_usd,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.ethPriceUsd}' THEN 1 END) = 7 THEN
    MAX(CASE WHEN series = '${SERIES.ethPriceUsd}' AND day = date(through_day, '-' || (weeks_back * 7) || ' days') THEN value END) END AS eth_price_usd,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.nearActiveAccounts}' THEN 1 END) = 7 THEN
    AVG(CASE WHEN series = '${SERIES.nearActiveAccounts}' THEN value END) END AS active_accounts_avg
FROM days
GROUP BY weeks_back
HAVING volume_days = 7
ORDER BY week_end DESC`,
    requests: [SOURCE_REQUESTS.duneVolume, SOURCE_REQUESTS.intentsVolume, SOURCE_REQUESTS.priceHistory, SOURCE_REQUESTS.nearblocksCharts],
    code: "src/lib/lead-lag.ts · runLeadLag (log changes, market fit, lagged correlations, block-bootstrap p-values, Holm)",
  },
  {
    id: "chain-activity",
    title: "Transactions and active, relayed and new accounts per day",
    page: "/dashboard/usage",
    sentence: "Daily NEAR transactions, those a relayer signed for another account and their share, active accounts (accounts that signed a transaction), accounts that acted through a relayer, and new accounts.",
    sql: `SELECT day, txns, relayed_txns, 1.0 * relayed_txns / txns AS relayed_share, active_accounts, relayed_accounts, new_accounts
FROM (${pivot({
      txns: SERIES.nearTxns,
      relayed_txns: SERIES.nearRelayedTxns,
      active_accounts: SERIES.nearActiveAccounts,
      relayed_accounts: SERIES.nearRelayedAccounts,
      new_accounts: SERIES.nearNewAccounts,
    })})
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.nearblocksDaily, SOURCE_REQUESTS.nearblocksCharts],
  },
  {
    id: "chain-activity-yoy",
    title: "Chain activity against a year earlier",
    page: "/dashboard/usage",
    sentence:
      "Transactions, new accounts and median daily active accounts over the 30 days to the newest day all three NearBlocks series have, against the same 30 days a year earlier. Each window also gives the share of transactions a relayer signed and the median daily accounts that acted through a relayer. A median needs all 30 days stored; a window with a missing day shows none.",
    sql: `WITH last AS (
  SELECT CASE WHEN COUNT(*) = 3 THEN MIN(last_day) END AS day FROM (
    SELECT MAX(day) AS last_day FROM daily_series
    WHERE series IN ('${SERIES.nearTxns}', '${SERIES.nearActiveAccounts}', '${SERIES.nearNewAccounts}') GROUP BY series)),
windows(name, end_day) AS (
  SELECT 'last 30 days', day FROM last UNION ALL SELECT 'same 30 days a year earlier', date(day, '-365 days') FROM last),
window_days AS (
  SELECT w.name, w.end_day, d.series, d.value,
    ROW_NUMBER() OVER (PARTITION BY w.name, d.series ORDER BY d.value) AS value_rank,
    COUNT(*) OVER (PARTITION BY w.name, d.series) AS series_days
  FROM windows w
  JOIN daily_series d ON d.series IN ('${SERIES.nearTxns}', '${SERIES.nearRelayedTxns}', '${SERIES.nearActiveAccounts}', '${SERIES.nearNewAccounts}', '${SERIES.nearRelayedAccounts}')
    AND d.day > date(w.end_day, '-30 days') AND d.day <= w.end_day)
SELECT name, end_day,
  SUM(CASE WHEN series = '${SERIES.nearTxns}' THEN value END) AS txns,
  COUNT(CASE WHEN series = '${SERIES.nearTxns}' THEN 1 END) AS txn_days,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.nearRelayedTxns}' THEN 1 END) = 30 AND COUNT(CASE WHEN series = '${SERIES.nearTxns}' THEN 1 END) = 30
    THEN SUM(CASE WHEN series = '${SERIES.nearRelayedTxns}' THEN value END) / SUM(CASE WHEN series = '${SERIES.nearTxns}' THEN value END) END AS relayed_share,
  COUNT(CASE WHEN series = '${SERIES.nearRelayedTxns}' THEN 1 END) AS relayed_txn_days,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.nearActiveAccounts}' THEN 1 END) = 30
    THEN AVG(CASE WHEN series = '${SERIES.nearActiveAccounts}' AND value_rank IN ((series_days + 1) / 2, (series_days + 2) / 2) THEN value END) END AS median_active_accounts,
  COUNT(CASE WHEN series = '${SERIES.nearActiveAccounts}' THEN 1 END) AS active_account_days,
  SUM(CASE WHEN series = '${SERIES.nearNewAccounts}' THEN value END) AS new_accounts,
  COUNT(CASE WHEN series = '${SERIES.nearNewAccounts}' THEN 1 END) AS new_account_days,
  CASE WHEN COUNT(CASE WHEN series = '${SERIES.nearRelayedAccounts}' THEN 1 END) = 30
    THEN AVG(CASE WHEN series = '${SERIES.nearRelayedAccounts}' AND value_rank IN ((series_days + 1) / 2, (series_days + 2) / 2) THEN value END) END AS median_relayed_accounts,
  COUNT(CASE WHEN series = '${SERIES.nearRelayedAccounts}' THEN 1 END) AS relayed_account_days
FROM window_days
GROUP BY name, end_day
ORDER BY end_day DESC`,
    requests: [SOURCE_REQUESTS.nearblocksDaily, SOURCE_REQUESTS.nearblocksCharts],
    code: "src/data/thesis-metrics/activity.ts · flowYoY, windowMedian",
  },
  {
    id: "intents-swaps",
    title: "NEAR Intents swaps per day",
    page: "/dashboard/usage",
    sentence: "NEAR Intents swaps per day, public and confidential, with that day's volume and the average swap size (volume ÷ swaps), from the NEAR team's Dune dashboard.",
    sql: `WITH ${THROUGH}, ${DUNE_THROUGH}
SELECT p.day, swaps, volume_usd, volume_usd / swaps AS avg_swap_usd
FROM (${pivot({ swaps: SERIES.intentsSwaps, volume_usd: SERIES.duneIntentsVolumeUsd })}) p, dune_through e
WHERE swaps > 0 AND p.day <= e.day
ORDER BY p.day DESC`,
    requests: [SOURCE_REQUESTS.duneSwaps, SOURCE_REQUESTS.duneVolume],
    code: "src/data/thesis-metrics/intents.ts · intentsMetrics (sumWindow, coversWindow)",
  },
  {
    id: "intents-chain-mix",
    title: "NEAR Intents volume by chain",
    page: "/dashboard/usage",
    sentence:
      "NEAR Intents volume, public and confidential, over the 30 days to the newest stored day, by the chain each swap counts under, with each chain's share. Rows appear only when all 30 days are stored.",
    sql: `WITH last AS (SELECT MAX(day) AS day FROM intents_chain_daily),
recent AS (
  SELECT chain, volume_usd FROM intents_chain_daily, last
  WHERE intents_chain_daily.day > date(last.day, '-30 days') AND intents_chain_daily.day <= last.day
    AND (SELECT COUNT(DISTINCT d.day) FROM intents_chain_daily d WHERE d.day > date(last.day, '-30 days') AND d.day <= last.day) = 30)
SELECT chain, SUM(volume_usd) AS volume_usd, SUM(volume_usd) / (SELECT SUM(volume_usd) FROM recent) AS share
FROM recent
GROUP BY chain
HAVING SUM(volume_usd) > 0
ORDER BY volume_usd DESC`,
    requests: [SOURCE_REQUESTS.duneChainVolume],
  },
  {
    id: "intents-stablecoin-share",
    title: "Stablecoin share of NEAR Intents volume",
    page: "/dashboard/usage",
    sentence:
      "NEAR Intents volume per day and the part counted under stablecoin symbols, with its share, from the volume by token on the NEAR team's Dune dashboard.",
    sql: `SELECT day, SUM(volume_usd) AS volume_usd,
  SUM(CASE WHEN UPPER(symbol) IN (${STABLECOIN_SQL_LIST}) THEN volume_usd ELSE 0 END) AS stablecoin_usd,
  SUM(CASE WHEN UPPER(symbol) IN (${STABLECOIN_SQL_LIST}) THEN volume_usd ELSE 0 END) / SUM(volume_usd) AS stablecoin_share
FROM intents_symbol_daily
GROUP BY day
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.duneSymbolVolume],
    code: "src/lib/metrics.ts · rollingWindows (7-day blocks)",
  },
  {
    id: "tvl-stablecoins",
    title: "DeFi TVL and stablecoins on NEAR",
    page: "/dashboard/usage",
    sentence: "DeFi TVL and USD-pegged stablecoins on NEAR, daily.",
    sql: `SELECT day, tvl_usd, stablecoins_usd
FROM (${pivot({ tvl_usd: SERIES.nearTvlUsd, stablecoins_usd: SERIES.nearStablecoinsUsd })})
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.tvl, SOURCE_REQUESTS.stablecoins],
  },
];
