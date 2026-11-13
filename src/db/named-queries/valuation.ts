/** Queries behind the charts on /dashboard/valuation. */
import { BUYBACKS_START_DAY, HSP029 } from "../../config/protocol.ts";
import { HOUSE_OF_STAKE_CONTRACT } from "../../config/sources.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import { FEES_THROUGH, FLOWS, SUPPLY_FLOWS, THROUGH } from "./fragments.ts";
import type { NamedQuery } from "./named-query.ts";

export const VALUATION_QUERIES: NamedQuery[] = [
  {
    id: "projection-inputs",
    title: "Starting values of the projections",
    page: "/dashboard/valuation",
    sentence: [
      "Every projection and the model start from these values, taken over the 30 days to the data-through day; a 30-day value is empty unless its series cover all 30 days.",
      "NEAR bought: the NEAR the 30 days' buyback dollars buy at today's price, as a monthly amount (the projections hold today's price), with the NEAR actually bought at each day's price beside it.",
      "Burn: gas fees in NEAR as a monthly amount, NEAR burned, the measured burned share of gas fees, and the share the projections burn (all of it once the protocol pays no gas to contracts).",
      "Volume: Intents volume over the 30 days and as a monthly amount, the share of volume that buys NEAR, which sets the volume a scenario needs, its multiple of the 30-day run rate and break-even, the fee rate (gross fees ÷ volume over the 30 days to the fee windows' last day, as the newest day of fees is still filling) and the share of fees that buys NEAR (share of volume that buys NEAR ÷ fee rate).",
      "Growth: NEAR bought over the 90 days to the data-through day against the 90 before, and as a monthly rate for the 90-day pace scenario; none until both 90-day windows fall after buying began.",
      "Market and protocol: today's price, market cap, total supply and max issuance rate, the NEAR minted behind break-even, and the end of HSP-029's timelock, which its ramp starts from.",
    ].join(" "),
    sql: `WITH ${THROUGH}, ${FEES_THROUGH}, ${FLOWS}, ${SUPPLY_FLOWS},
fees30 AS (
  SELECT SUM(f.fees_usd) / SUM(f.volume_usd) AS fee_rate
  FROM flows f, fees_through t
  WHERE f.day > date(t.day, '-30 days') AND f.day <= t.day
  HAVING COUNT(f.fees_usd) = 30 AND COUNT(f.volume_usd) = 30),
last30 AS (
  SELECT CASE WHEN COUNT(f.minted_near) = 30 THEN SUM(f.minted_near) END AS minted_near,
    CASE WHEN COUNT(f.bought_near) = 30 THEN SUM(f.bought_near) END AS bought_near,
    CASE WHEN COUNT(f.fees_near) = 30 THEN SUM(f.fees_near) END AS fees_near,
    CASE WHEN COUNT(f.burnt_near) = 30 THEN SUM(f.burnt_near) END AS burnt_near
  FROM supply_flows f, through t
  WHERE f.day > date(t.day, '-30 days') AND f.day <= t.day),
take30 AS (
  SELECT CASE WHEN COUNT(f.buybacks_usd) = 30 THEN SUM(f.buybacks_usd) END AS buybacks_usd,
    CASE WHEN COUNT(f.volume_usd) = 30 THEN SUM(f.volume_usd) END AS volume_usd,
    CASE WHEN COUNT(f.buybacks_usd) = 30 AND COUNT(f.volume_usd) = 30 THEN SUM(f.buybacks_usd) / SUM(f.volume_usd) END AS take_rate
  FROM flows f, through t
  WHERE f.day > date(t.day, '-30 days') AND f.day <= t.day),
bought90 AS (
  SELECT CASE WHEN date(t.day, '-179 days') >= '${BUYBACKS_START_DAY}' AND COUNT(f.bought_near) = 180 THEN
      SUM(CASE WHEN f.day > date(t.day, '-90 days') THEN f.bought_near END) / SUM(CASE WHEN f.day <= date(t.day, '-90 days') THEN f.bought_near END) - 1
    END AS change_90d
  FROM flows f, through t
  WHERE f.day > date(t.day, '-180 days') AND f.day <= t.day)
SELECT t.day AS through_day, c.price_usd, c.market_cap_usd, n.total_supply_near, n.max_inflation_rate,
  w.buybacks_usd / c.price_usd * 365.0 / 30 / 12 AS bought_near_per_month,
  l.fees_near * 365.0 / 30 / 12 AS fees_near_per_month,
  l.burnt_near / l.fees_near AS measured_burn_share,
  CASE WHEN n.burnt_gas_share_to_contracts = 0 THEN 1.0 ELSE l.burnt_near / l.fees_near END AS burn_share_of_fees,
  w.take_rate AS take_rate_30d,
  w.volume_usd AS volume_30d_usd,
  w.volume_usd * 365.0 / 30 / 12 AS volume_usd_per_month,
  (SELECT fee_rate FROM fees30) AS fee_rate_30d,
  w.take_rate / (SELECT fee_rate FROM fees30) AS capture_rate_30d,
  b.change_90d AS bought_change_90d,
  pow(1 + b.change_90d, 365.0 / 12 / 90) - 1 AS bought_monthly_growth,
  l.minted_near AS minted_near_30d,
  l.burnt_near AS burnt_near_30d,
  l.bought_near AS bought_near_30d,
  (SELECT timelock_ends_at FROM governance_proposals WHERE contract = '${HOUSE_OF_STAKE_CONTRACT}' AND proposal_id = ${HSP029.proposalId}) AS hsp029_timelock_ends_at
FROM through t, last30 l, take30 w, bought90 b, coins_latest c, network_latest n
WHERE c.coin_id = 'near'`,
    requests: [
      SOURCE_REQUESTS.intentsBuybacks,
      SOURCE_REQUESTS.duneVolume,
      SOURCE_REQUESTS.intentsVolume,
      SOURCE_REQUESTS.duneFees,
      SOURCE_REQUESTS.intentsFees,
      SOURCE_REQUESTS.chainFees,
      SOURCE_REQUESTS.epochHeaders,
      SOURCE_REQUESTS.nearPrice,
      SOURCE_REQUESTS.markets,
      SOURCE_REQUESTS.block,
      SOURCE_REQUESTS.protocolConfig,
      SOURCE_REQUESTS.hsp029,
    ],
    code: "src/lib/projection.ts · coverageScenarios, coveringGrowth (month-by-month projection from these values)",
  },
  {
    id: "revenue-multiple",
    title: "NEAR market cap ÷ network revenue",
    page: "/dashboard/valuation",
    sentence:
      "NEAR's market cap each day against its network revenue (NEAR Intents revenue plus gas fees) of the 30 days to that day, annualized. It starts once the whole 30-day window falls in or after the first month with NEAR Intents revenue on every day, because earlier revenue arrived in occasional lumps; days without all 30 days of revenue are left out.",
    sql: `WITH first_full AS (
  SELECT MIN(month) AS month FROM (
    SELECT substr(day, 1, 7) AS month, COUNT(*) AS days FROM daily_series
    WHERE series = '${SERIES.intentsRevenueUsd}' AND value > 0
    GROUP BY month
    HAVING days = CAST(strftime('%d', date(month || '-01', '+1 month', '-1 day')) AS INTEGER))),
revenue AS (
  SELECT day, SUM(value) AS revenue_usd, COUNT(*) AS parts FROM daily_series
  WHERE series IN ('${SERIES.intentsRevenueUsd}', '${SERIES.nearChainFeesUsd}')
  GROUP BY day HAVING parts = 2),
cap AS (
  SELECT s.day, s.circulating_supply * p.value AS market_cap_usd
  FROM coin_supply_daily s JOIN daily_series p ON p.series = '${SERIES.nearPriceUsd}' AND p.day = s.day
  WHERE s.coin_id = 'near'),
rev30 AS (
  SELECT day, SUM(revenue_usd) OVER w AS revenue_30d_usd, COUNT(*) OVER w AS revenue_days
  FROM revenue
  WINDOW w AS (ORDER BY julianday(day) RANGE BETWEEN 29 PRECEDING AND CURRENT ROW)),
windows AS (
  SELECT c.day, c.market_cap_usd, r.revenue_30d_usd, r.revenue_days
  FROM cap c JOIN rev30 r ON r.day = c.day)
SELECT day, market_cap_usd, revenue_30d_usd, market_cap_usd / (revenue_30d_usd * 365.0 / 30) AS multiple
FROM windows, first_full f
WHERE revenue_days = 30 AND windows.day >= date(f.month || '-01', '+29 days')
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.intentsRevenue, SOURCE_REQUESTS.chainFees, SOURCE_REQUESTS.peerSupply, SOURCE_REQUESTS.nearPrice],
    code: "src/lib/metrics.ts · revenueMultiple",
  },
];
