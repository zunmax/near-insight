/** Queries behind the charts on /dashboard/supply: supply flows, the protocol treasury and the HSP-029 vote. */
import { BUYBACKS_START_DAY, PROTOCOL_TREASURY_SHARE } from "../../config/protocol.ts";
import { PROTOCOL_TREASURY_ACCOUNT } from "../../config/sources.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import { SUPPLY_FLOWS, THROUGH } from "./fragments.ts";
import type { NamedQuery } from "./named-query.ts";

export const SUPPLY_QUERIES: NamedQuery[] = [
  {
    id: "absorption",
    title: "New supply absorbed by burn and buybacks",
    page: "/dashboard/supply",
    sentence: `NEAR burned and bought against NEAR minted over the 30 and 90 days, the days since buybacks began on ${BUYBACKS_START_DAY}, and the 365 days to the data-through day. A window counts only when NEAR minted, burned and bought cover every one of its days.`,
    sql: `WITH ${THROUGH}, ${SUPPLY_FLOWS},
windows AS (
  SELECT '30 days' AS name, 30 AS days UNION ALL SELECT '90 days', 90
  UNION ALL SELECT 'since buybacks began', CAST(julianday(day) - julianday('${BUYBACKS_START_DAY}') + 1 AS INTEGER) FROM through
  UNION ALL SELECT '365 days', 365)
SELECT w.name AS window_name, w.days, t.day AS through_day, COUNT(minted_near) AS minted_days,
  SUM(minted_near) AS minted_near, SUM(burnt_near) AS burnt_near, SUM(bought_near) AS bought_near,
  SUM(burnt_near) / SUM(minted_near) AS burnt_share,
  SUM(bought_near) / SUM(minted_near) AS bought_share,
  (SUM(burnt_near) + SUM(bought_near)) / SUM(minted_near) AS absorbed_share
FROM windows w, through t, supply_flows f
WHERE f.day > date(t.day, '-' || w.days || ' days') AND f.day <= t.day
GROUP BY w.name, w.days
HAVING COUNT(minted_near) = w.days AND COUNT(burnt_near) = w.days AND COUNT(bought_near) = w.days
ORDER BY w.days, w.name`,
    requests: [SOURCE_REQUESTS.epochHeaders, SOURCE_REQUESTS.intentsBuybacks, SOURCE_REQUESTS.nearPrice],
    code: "src/lib/metrics.ts · absorption, coversWindow",
  },
  {
    id: "absorption-monthly",
    title: "New supply absorbed by month",
    page: "/dashboard/supply",
    sentence: "Each calendar month's NEAR burned and bought as shares of the NEAR minted that month.",
    sql: `WITH ${THROUGH}, ${SUPPLY_FLOWS}
SELECT substr(supply_flows.day, 1, 7) AS month, COUNT(*) AS days, SUM(minted_near) AS minted_near, SUM(burnt_near) AS burnt_near,
  SUM(bought_near) AS bought_near, (SUM(burnt_near) + COALESCE(SUM(bought_near), 0)) / SUM(minted_near) AS absorbed_share
FROM supply_flows, through t
WHERE minted_near IS NOT NULL AND burnt_near IS NOT NULL AND supply_flows.day <= t.day
GROUP BY month
ORDER BY month DESC`,
    requests: [SOURCE_REQUESTS.epochHeaders, SOURCE_REQUESTS.intentsBuybacks, SOURCE_REQUESTS.nearPrice],
  },
  {
    id: "epoch-supply",
    title: "NEAR minted and burned per epoch",
    page: "/dashboard/supply",
    sentence: "Every stored epoch with its total supply at the first and last block, and the NEAR minted and burned, measured from block headers.",
    sql: `SELECT epoch_id, start_height, start_time, end_height, end_time, supply_start_near, supply_end_near, minted_near, burnt_near
FROM epoch_supply
ORDER BY start_height DESC`,
    requests: [SOURCE_REQUESTS.epochHeaders],
    code: "src/ingest/sources/near.ts · epochSupply",
  },
  {
    id: "total-supply",
    title: "Total NEAR supply",
    page: "/dashboard/supply",
    sentence: "Total NEAR supply by day.",
    sql: `SELECT day, value AS total_supply_near
FROM daily_series
WHERE series = '${SERIES.nearTotalSupply}'
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.nearblocksDaily, SOURCE_REQUESTS.block],
  },
  {
    id: "protocol-treasury",
    title: "NEAR in the protocol treasury",
    page: "/dashboard/supply",
    sentence: `${PROTOCOL_TREASURY_ACCOUNT}'s NEAR at the end of each day, its gain over the 30 days to that day, and ${PROTOCOL_TREASURY_SHARE * 100}% of the NEAR minted in those days (what the protocol pays it).`,
    sql: `SELECT t.day, t.value AS treasury_near,
  t.value - (SELECT p.value FROM daily_series p WHERE p.series = '${SERIES.treasuryNear}' AND p.day = date(t.day, '-30 days')) AS gain_30d_near,
  (SELECT SUM(m.value) FROM daily_series m
   WHERE m.series = '${SERIES.mintedNear}' AND m.day > date(t.day, '-30 days') AND m.day <= t.day) * ${PROTOCOL_TREASURY_SHARE} AS paid_30d_near
FROM daily_series t
WHERE t.series = '${SERIES.treasuryNear}'
  AND t.day <= (SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.mintedNear}')
ORDER BY t.day DESC`,
    requests: [SOURCE_REQUESTS.treasuryBalance, SOURCE_REQUESTS.epochHeaders],
    code: "src/data/thesis-metrics/supply.ts · treasuryWindow, treasuryMetrics (gain and share over the 30 days both cover)",
  },
  {
    id: "hsp029-vote",
    title: "HSP-029 vote",
    page: "/dashboard/supply",
    sentence: "The House of Stake vote on HSP-029 as last read from the voting contract.",
    sql: `SELECT proposal_id, title, status, venear_for, venear_against, venear_abstain, venear_snapshot, voters,
  quorum_threshold_bps, approval_threshold_bps, voting_ends_at, timelock_ends_at, fetched_at
FROM governance_proposals`,
    requests: [SOURCE_REQUESTS.hsp029],
  },
];
