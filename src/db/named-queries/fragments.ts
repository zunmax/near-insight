/** The SQL fragments that several catalog queries share. */
import { MAX_PULL_BACK_DAYS } from "../../config/ingest.ts";
import { CORE_SERIES, SERIES, type SeriesName } from "../schema.ts";

const quoted = (series: SeriesName[]) => series.map((name) => `'${name}'`).join(", ");

/** CTE `name` (one row, `day`): the newest day from `lastCte`'s day back up to MAX_PULL_BACK_DAYS on which every one of
    `series` has the 30 days ending there, or `lastCte`'s day when none does (FlowContext.completeEnd). */
function completeEnd(name: string, lastCte: string, series: SeriesName[]): string {
  const backs = Array.from({ length: MAX_PULL_BACK_DAYS + 1 }, (_, back) => `(${back})`).join(", ");
  return `${name} AS (
  SELECT COALESCE((
    SELECT date(l.day, '-' || b.column1 || ' days') FROM ${lastCte} l, (VALUES ${backs}) b
    WHERE (SELECT COUNT(*) FROM daily_series s WHERE s.series IN (${quoted(series)})
      AND s.day > date(l.day, '-' || (b.column1 + 30) || ' days') AND s.day <= date(l.day, '-' || b.column1 || ' days')) = ${30 * series.length}
    ORDER BY b.column1 LIMIT 1), (SELECT day FROM ${lastCte})) AS day)`;
}

/** The dashboard's data-through day (FlowContext.through): the last day Intents volume, buybacks, gas fees and the NEAR price
    all cover, or earlier before a day missing from them or from NEAR minted and burned. */
export const THROUGH = `core_last AS (
  SELECT CASE WHEN COUNT(*) = ${CORE_SERIES.length} THEN MIN(last_day) END AS day FROM (
    SELECT MAX(day) AS last_day FROM daily_series
    WHERE series IN (${quoted(CORE_SERIES)})
    GROUP BY series)),
${completeEnd("through", "core_last", [...CORE_SERIES, SERIES.mintedNear, SERIES.burntNear])}`;

/** Last day of the Dune-only windows (swaps, confidential volume): the newest day both Dune series have, at most the
    data-through day, or earlier before a day missing from them or Intents volume (duneThrough). Needs THROUGH before it. */
export const DUNE_THROUGH = `dune_last AS (
  SELECT CASE WHEN COUNT(day) = 3 THEN MIN(day) END AS day FROM (
    SELECT day FROM through
    UNION ALL SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.intentsSwaps}'
    UNION ALL SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.intentsConfidentialVolumeUsd}')),
${completeEnd("dune_through", "dune_last", [SERIES.intentsSwaps, SERIES.intentsConfidentialVolumeUsd, SERIES.intentsVolumeUsd])}`;

/** Last day of the fee windows: the data-through day, or the last day Intents fees and revenue both have when earlier, or
    earlier before a day missing from them or Intents volume (feeChain.through). Needs THROUGH before it. */
export const FEES_THROUGH = `fees_last AS (
  SELECT CASE WHEN COUNT(day) = 3 THEN MIN(day) END AS day FROM (
    SELECT day FROM through
    UNION ALL SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.intentsFeesUsd}'
    UNION ALL SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.intentsRevenueUsd}')),
${completeEnd("fees_through", "fees_last", [SERIES.intentsFeesUsd, SERIES.intentsRevenueUsd, SERIES.intentsVolumeUsd])}`;

/** One row per day with the named series as columns. */
export const pivot = (columns: Record<string, SeriesName>) => `SELECT day,
${Object.entries(columns)
  .map(([column, series]) => `    MAX(CASE WHEN series = '${series}' THEN value END) AS ${column}`)
  .join(",\n")}
  FROM daily_series
  WHERE series IN (${quoted(Object.values(columns))})
  GROUP BY day`;

const CG_FIRST_DAY = `(SELECT MIN(day) FROM daily_series WHERE series = '${SERIES.nearPriceUsd}')`;
/** A row's NEAR price: CoinGecko's, the DefiLlama price history's on days before CoinGecko's first (getNearPrices), or on a
    day missing from both the latest earlier price, as toNear carries it forward. */
const NEAR_PRICE = `COALESCE(p.price_usd,
      (SELECT h.value FROM daily_series h WHERE h.series = '${SERIES.nearPriceHistoryUsd}' AND h.day = p.day AND h.day < ${CG_FIRST_DAY}),
      (SELECT q.value FROM daily_series q WHERE q.day < p.day
        AND (q.series = '${SERIES.nearPriceUsd}' OR (q.series = '${SERIES.nearPriceHistoryUsd}' AND q.day < ${CG_FIRST_DAY}))
        ORDER BY q.day DESC LIMIT 1))`;

/** Intents flows by day, with NEAR bought at that day's NEAR price. */
export const FLOWS = `flows AS (
  SELECT day, volume_usd, fees_usd, revenue_usd, buybacks_usd, price_usd,
    buybacks_usd / price_usd AS bought_near, revenue_usd / price_usd AS revenue_near
  FROM (SELECT p.day, p.volume_usd, p.fees_usd, p.revenue_usd, p.buybacks_usd, ${NEAR_PRICE} AS price_usd
    FROM (${pivot({
      volume_usd: SERIES.intentsVolumeUsd,
      fees_usd: SERIES.intentsFeesUsd,
      revenue_usd: SERIES.intentsRevenueUsd,
      buybacks_usd: SERIES.intentsBuybacksUsd,
      price_usd: SERIES.nearPriceUsd,
    })}) p))`;

/** NEAR minted, burned and bought by day, and gas fees in NEAR. */
export const SUPPLY_FLOWS = `supply_flows AS (
  SELECT day, minted_near, burnt_near, buybacks_usd / price_usd AS bought_near, chain_fees_usd / price_usd AS fees_near
  FROM (SELECT p.day, p.minted_near, p.burnt_near, p.buybacks_usd, p.chain_fees_usd, ${NEAR_PRICE} AS price_usd
    FROM (${pivot({
      minted_near: SERIES.mintedNear,
      burnt_near: SERIES.burntNear,
      buybacks_usd: SERIES.intentsBuybacksUsd,
      chain_fees_usd: SERIES.nearChainFeesUsd,
      price_usd: SERIES.nearPriceUsd,
    })}) p))`;
