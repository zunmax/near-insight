/** Queries behind the charts on /dashboard/revenue. */
import { BUYBACKS_START_DAY } from "../../config/protocol.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import { FEES_THROUGH, FLOWS, SUPPLY_FLOWS, THROUGH, pivot } from "./fragments.ts";
import type { NamedQuery } from "./named-query.ts";

export const REVENUE_QUERIES: NamedQuery[] = [
  {
    id: "fee-chain-30d",
    title: "From NEAR Intents volume to NEAR bought, 30 days",
    page: "/dashboard/revenue",
    sentence:
      "NEAR Intents volume, gross fees, revenue (the part of fees the app operators keep), buyback dollars and NEAR bought over the 30 days to the fee windows' last day, with each step's share. That day is the data-through day, or the last day of fees and revenue when earlier, since the newest day of fees is still filling. The last column is a year of NEAR bought at this pace as a share of circulating NEAR (market cap ÷ price). The row appears only when volume, fees, revenue and NEAR bought cover all 30 days.",
    sql: `WITH ${THROUGH}, ${FEES_THROUGH}, ${FLOWS}
SELECT t.day AS through_day, COUNT(*) AS days,
  SUM(volume_usd) AS volume_usd, SUM(fees_usd) AS fees_usd, SUM(revenue_usd) AS revenue_usd, SUM(buybacks_usd) AS buybacks_usd,
  SUM(bought_near) AS bought_near,
  SUM(fees_usd) / SUM(volume_usd) AS fees_of_volume,
  SUM(revenue_usd) / SUM(fees_usd) AS revenue_of_fees,
  SUM(buybacks_usd) / SUM(revenue_usd) AS buybacks_of_revenue,
  SUM(buybacks_usd) / SUM(fees_usd) AS capture_rate,
  SUM(bought_near) * 365.0 / 30 / (SELECT market_cap_usd / price_usd FROM coins_latest WHERE coin_id = 'near') AS bought_yearly_share_of_circulating
FROM flows, fees_through t
WHERE flows.day > date(t.day, '-30 days') AND flows.day <= t.day
HAVING COUNT(volume_usd) = 30 AND COUNT(fees_usd) = 30 AND COUNT(revenue_usd) = 30 AND COUNT(bought_near) = 30`,
    requests: [SOURCE_REQUESTS.duneVolume, SOURCE_REQUESTS.duneFees, SOURCE_REQUESTS.intentsVolume, SOURCE_REQUESTS.intentsFees, SOURCE_REQUESTS.intentsRevenue, SOURCE_REQUESTS.intentsBuybacks, SOURCE_REQUESTS.nearPrice, SOURCE_REQUESTS.markets],
    code: "src/ingest/jobs/merge-intents.ts · mergeIntentsFlows; src/lib/metrics.ts · feeChain, toNear",
  },
  {
    id: "fee-rate-monthly",
    title: "NEAR Intents fees per $1M swapped, by month",
    page: "/dashboard/revenue",
    sentence:
      "NEAR Intents gross fees per $1 million swapped, over the 30 and 90 days to the fee windows' last day and in each calendar month through that day. A 30- or 90-day row appears only when volume and fees cover all its days.",
    sql: `WITH ${THROUGH}, ${FEES_THROUGH}, ${FLOWS}, windows(days) AS (VALUES (30), (90))
SELECT 'last ' || w.days || ' days' AS month, COUNT(*) AS days, SUM(volume_usd) AS volume_usd, SUM(fees_usd) AS fees_usd,
  SUM(fees_usd) / SUM(volume_usd) * 1000000 AS fees_per_1m_usd
FROM windows w, flows, fees_through t
WHERE flows.day > date(t.day, '-' || w.days || ' days') AND flows.day <= t.day
GROUP BY w.days
HAVING COUNT(volume_usd) = w.days AND COUNT(fees_usd) = w.days
UNION ALL
SELECT substr(flows.day, 1, 7) AS month, COUNT(*) AS days, SUM(volume_usd) AS volume_usd, SUM(fees_usd) AS fees_usd,
  SUM(fees_usd) / SUM(volume_usd) * 1000000 AS fees_per_1m_usd
FROM flows, fees_through t
WHERE fees_usd IS NOT NULL AND volume_usd > 0 AND flows.day <= t.day
GROUP BY substr(flows.day, 1, 7)
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.duneVolume, SOURCE_REQUESTS.duneFees, SOURCE_REQUESTS.intentsVolume, SOURCE_REQUESTS.intentsFees],
    code: "src/data/thesis-metrics/revenue.ts · feeChainMetrics (30- and 90-day fee rates: fees ÷ volume); src/lib/metrics.ts · feeChain, monthlyTable (months)",
  },
  {
    id: "referral-fees-30d",
    title: "Who pays NEAR Intents fees",
    page: "/dashboard/revenue",
    sentence:
      "Completed 1Click swaps over the 30 days to the newest stored day, by referral (the front end, wallet or app a swap came through). Each row gives swaps, dollars swapped in, app fees, the referral's share of all app fees and volume, and its fee rate in basis points. Rows appear only when all 30 days are stored.",
    sql: `WITH last AS (SELECT MAX(day) AS day FROM intents_referral_daily),
days30 AS (SELECT r.* FROM intents_referral_daily r, last WHERE r.day > date(last.day, '-30 days') AND r.day <= last.day)
SELECT (SELECT day FROM last) AS through_day, referral, SUM(swaps) AS swaps, SUM(volume_usd) AS volume_usd, SUM(fees_usd) AS fees_usd,
  SUM(fees_usd) / (SELECT SUM(fees_usd) FROM days30) AS share_of_fees,
  SUM(volume_usd) / (SELECT SUM(volume_usd) FROM days30) AS share_of_volume,
  SUM(fees_usd) / SUM(volume_usd) * 10000 AS fee_rate_bps
FROM days30
GROUP BY referral
HAVING (SELECT COUNT(DISTINCT day) FROM days30) = 30
ORDER BY fees_usd DESC`,
    requests: [SOURCE_REQUESTS.explorerSwaps],
    code: "src/data/intents-flows.ts · getReferralWindow; src/data/thesis-metrics/revenue.ts · referralMetrics",
  },
  {
    id: "fee-channels",
    title: "NEAR Intents fees by channel",
    page: "/dashboard/revenue",
    sentence:
      "Gross fees by channel (the referral a swap carries: a front end, wallet or app) from NEAR Intents' launch through as_of, with each channel's share of the listed channels' fees. Dune lists the 100 largest channels above $10 and leaves out swaps without a referral.",
    sql: `SELECT channel, fees_usd, fees_usd / (SELECT SUM(fees_usd) FROM intents_fee_channels) AS share, as_of
FROM intents_fee_channels
ORDER BY fees_usd DESC`,
    requests: [SOURCE_REQUESTS.duneFeeChannels],
  },
  {
    id: "capture-rate-monthly",
    title: "Share of fees that buys NEAR, by month",
    page: "/dashboard/revenue",
    sentence: `Buyback dollars against NEAR Intents gross fees over the 90 days to the fee windows' last day and by calendar month through that day. Fees count from ${BUYBACKS_START_DAY}, the first day of buying, so the month buying began is not diluted by the days before it. Buying days are a month's days since buying began. The 90-day row appears only when volume, fees, revenue and NEAR bought cover all 90 days.`,
    sql: `WITH ${THROUGH}, ${FEES_THROUGH}, ${FLOWS}, windows(days) AS (VALUES (90))
SELECT 'last ' || w.days || ' days' AS month, COUNT(*) AS days, SUM(flows.day >= '${BUYBACKS_START_DAY}' AND buybacks_usd IS NOT NULL) AS buying_days, SUM(fees_usd) AS fees_usd,
  SUM(CASE WHEN flows.day >= '${BUYBACKS_START_DAY}' THEN fees_usd END) AS fees_since_buybacks_usd, SUM(buybacks_usd) AS buybacks_usd,
  SUM(buybacks_usd) / SUM(CASE WHEN flows.day >= '${BUYBACKS_START_DAY}' THEN fees_usd END) AS capture_rate
FROM windows w, flows, fees_through t
WHERE flows.day > date(t.day, '-' || w.days || ' days') AND flows.day <= t.day
GROUP BY w.days
HAVING COUNT(volume_usd) = w.days AND COUNT(fees_usd) = w.days AND COUNT(revenue_usd) = w.days AND COUNT(bought_near) = w.days
UNION ALL
SELECT substr(flows.day, 1, 7) AS month, COUNT(*) AS days, SUM(flows.day >= '${BUYBACKS_START_DAY}' AND buybacks_usd IS NOT NULL) AS buying_days, SUM(fees_usd) AS fees_usd,
  SUM(CASE WHEN flows.day >= '${BUYBACKS_START_DAY}' THEN fees_usd END) AS fees_since_buybacks_usd, SUM(buybacks_usd) AS buybacks_usd,
  SUM(buybacks_usd) / SUM(CASE WHEN flows.day >= '${BUYBACKS_START_DAY}' THEN fees_usd END) AS capture_rate
FROM flows, fees_through t
WHERE fees_usd IS NOT NULL AND flows.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.duneFees, SOURCE_REQUESTS.intentsFees, SOURCE_REQUESTS.intentsBuybacks],
  },
  {
    id: "bought-by-month",
    title: "NEAR bought by month",
    page: "/dashboard/revenue",
    sentence: `NEAR bought each calendar month from ${BUYBACKS_START_DAY}, the first day of buying, through the data-through day. Each day's buyback dollars convert at that day's NEAR price. A month's days count every stored day since buying began.`,
    sql: `WITH ${THROUGH}, ${FLOWS}
SELECT substr(flows.day, 1, 7) AS month, COUNT(*) AS days, SUM(buybacks_usd) AS buybacks_usd, SUM(bought_near) AS bought_near
FROM flows, through t
WHERE flows.day >= '${BUYBACKS_START_DAY}' AND buybacks_usd IS NOT NULL AND flows.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.intentsBuybacks, SOURCE_REQUESTS.nearPrice],
    code: "src/lib/metrics.ts · toNear, monthlySums",
  },
  {
    id: "revenue-units",
    title: "NEAR Intents revenue in dollars and in NEAR",
    page: "/dashboard/revenue",
    sentence:
      "Monthly NEAR Intents revenue through the fee windows' last day, in USD and in NEAR (each day at its own price), as a total and per day. The chart uses revenue per day in months with revenue on every day, and indexes both to 100 in the first of those months.",
    sql: `WITH ${THROUGH}, ${FEES_THROUGH}, ${FLOWS}
SELECT substr(flows.day, 1, 7) AS month, COUNT(*) AS days, SUM(revenue_usd > 0) AS revenue_days, SUM(revenue_usd) AS revenue_usd, SUM(revenue_near) AS revenue_near,
  SUM(revenue_usd) / SUM(revenue_usd > 0) AS revenue_usd_per_day, SUM(revenue_near) / SUM(revenue_usd > 0) AS revenue_near_per_day
FROM flows, fees_through t
WHERE revenue_usd IS NOT NULL AND price_usd IS NOT NULL AND flows.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.intentsRevenue, SOURCE_REQUESTS.nearPrice],
    code: "src/lib/metrics.ts · toNear, indexTo100",
  },
  {
    id: "fee-wallets",
    title: "NEAR in the three fee wallets",
    page: "/dashboard/revenue",
    sentence: "NEAR held by each of the three fee wallets at the end of each finished UTC day; today's row is the latest NEAR RPC reading.",
    sql: `SELECT day, buyback_near, frontend_near, one_click_near, buyback_near + frontend_near + one_click_near AS total_near
FROM (${pivot({ buyback_near: SERIES.buybackWalletNear, frontend_near: SERIES.frontendFeeWalletNear, one_click_near: SERIES.oneClickFeeWalletNear })})
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.walletBalances],
  },
  {
    id: "burn-by-month",
    title: "NEAR burned by month",
    page: "/dashboard/revenue",
    sentence:
      "NEAR burned over the 30 days to the data-through day and each month, measured from block headers, with the burned share of gas fees on the days both are stored.",
    sql: `WITH ${THROUGH}, ${SUPPLY_FLOWS}, windows(days) AS (VALUES (30))
SELECT 'last ' || w.days || ' days' AS month, COUNT(burnt_near) AS days, SUM(burnt_near) AS burnt_near, SUM(fees_near) AS gas_fees_near,
  SUM(CASE WHEN fees_near IS NOT NULL THEN burnt_near END) / SUM(fees_near) AS burn_share
FROM windows w, supply_flows, through t
WHERE burnt_near IS NOT NULL AND supply_flows.day > date(t.day, '-' || w.days || ' days') AND supply_flows.day <= t.day
GROUP BY w.days
HAVING COUNT(burnt_near) = w.days AND COUNT(fees_near) = w.days
UNION ALL
SELECT substr(supply_flows.day, 1, 7) AS month, COUNT(burnt_near) AS days, SUM(burnt_near) AS burnt_near, SUM(fees_near) AS gas_fees_near,
  SUM(CASE WHEN fees_near IS NOT NULL THEN burnt_near END) / SUM(fees_near) AS burn_share
FROM supply_flows, through t
WHERE burnt_near IS NOT NULL AND supply_flows.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.epochHeaders, SOURCE_REQUESTS.chainFees, SOURCE_REQUESTS.nearPrice],
    code: "src/ingest/sources/near.ts · epochSupply; src/ingest/days.ts · spreadOverDays",
  },
];
