/** Queries behind the charts on /dashboard/network: validator stake and active developers. */
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import { SERIES } from "../schema.ts";
import { pivot } from "./fragments.ts";
import type { NamedQuery } from "./named-query.ts";

export const NETWORK_QUERIES: NamedQuery[] = [
  {
    id: "validator-stake",
    title: "Stake by validator",
    page: "/dashboard/network",
    sentence:
      "Validators of the latest stored epoch by stake, with their running share; the rank of the first row past a third of all stake is the Nakamoto coefficient (validators = staking pools).",
    sql: `WITH latest AS (SELECT MAX(epoch_height) AS epoch FROM validator_epochs),
v AS (SELECT account_id, stake_near, produces_blocks FROM validator_epochs, latest WHERE epoch_height = latest.epoch),
ranked AS (
  SELECT account_id, stake_near, produces_blocks,
    ROW_NUMBER() OVER (ORDER BY stake_near DESC) AS rank,
    stake_near / SUM(stake_near) OVER () AS share,
    SUM(stake_near) OVER (ORDER BY stake_near DESC ROWS UNBOUNDED PRECEDING) / SUM(stake_near) OVER () AS running_share
  FROM v)
SELECT rank, account_id, stake_near, produces_blocks, share, running_share,
  running_share > 1.0 / 3 AND running_share - share <= 1.0 / 3 AS reaches_a_third
FROM ranked
ORDER BY rank`,
    requests: [SOURCE_REQUESTS.validators],
    code: "src/lib/metrics.ts · nakamotoCoefficient, seatPrices",
  },
  {
    id: "developers",
    title: "Monthly active developers",
    page: "/dashboard/network",
    sentence: "Monthly active developers for NEAR, Ethereum, Solana and Bitcoin on the first of each month.",
    sql: `SELECT day, near, near_full_time, ethereum, solana, bitcoin
FROM (${pivot({
      near: SERIES.devsAllNear,
      near_full_time: SERIES.devsFullTimeNear,
      ethereum: SERIES.devsAllEthereum,
      solana: SERIES.devsAllSolana,
      bitcoin: SERIES.devsAllBitcoin,
    })})
WHERE substr(day, 9, 2) = '01'
ORDER BY day DESC`,
    requests: [SOURCE_REQUESTS.developers],
  },
];
