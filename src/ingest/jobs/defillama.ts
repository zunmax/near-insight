/** DefiLlama jobs: NEAR Intents, DEX, fee, TVL and stablecoin series, and daily coin prices for the lead-lag test. */
import { COIN_PRICE_HISTORY_START, COIN_PRICE_REFRESH_DAYS, INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { PRICE_HISTORY_COINS } from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, SERIES, type SeriesName } from "../../db/schema.ts";
import { errorMessage } from "../../lib/validate.ts";
import { addDays, today, yesterday, type DayValue } from "../days.ts";
import {
  fetchCoinPriceHistory,
  fetchIntentsBuybacks,
  fetchIntentsFees,
  fetchIntentsRevenue,
  fetchIntentsVolume,
  fetchNearChainFees,
  fetchNearDexVolume,
  fetchNearStablecoins,
  fetchNearTvl,
} from "../sources/defillama.ts";
import type { Job } from "./job.ts";
import { mergeIntentsFlows } from "./merge-intents.ts";
import { upsertSeries } from "./storage.ts";

/** DefiLlama fills a day's flow total during the next day (Intents fees for 2026-11-02 read 22,638 at 08:10 UTC on 11-03,
    against about 150,000 a day; final by that evening), so flow series keep only days before yesterday (UTC). Intents
    volume and fees are stored as DefiLlama's own series and merged with Dune's (mergeIntentsFlows). */
export const defillamaJob: Job = {
  name: JOBS.defillama,
  everyMs: INGEST_SCHEDULE_MS.defillama,
  async run(db) {
    /** [series, fetcher, flow]: flows are daily totals; TVL and stablecoins are levels, where the newest point is current. */
    const sources: Array<[SeriesName, () => Promise<DayValue[]>, boolean]> = [
      [SERIES.defillamaIntentsVolumeUsd, fetchIntentsVolume, true],
      [SERIES.intentsBuybacksUsd, fetchIntentsBuybacks, true],
      [SERIES.defillamaIntentsFeesUsd, fetchIntentsFees, true],
      [SERIES.intentsRevenueUsd, fetchIntentsRevenue, true],
      [SERIES.nearDexVolumeUsd, fetchNearDexVolume, true],
      [SERIES.nearChainFeesUsd, fetchNearChainFees, true],
      [SERIES.nearTvlUsd, fetchNearTvl, false],
      [SERIES.nearStablecoinsUsd, fetchNearStablecoins, false],
    ];
    const results = await Promise.allSettled(sources.map(([, fetchSeries]) => fetchSeries()));
    const firstIncomplete = yesterday();
    const rows = transaction(db, () => {
      const written = sources.reduce((sum, [series, , flow], i) => {
        const result = results[i]!;
        if (result.status === "rejected") return sum;
        return sum + upsertSeries(db, series, flow ? result.value.filter((p) => p.day < firstIncomplete) : result.value);
      }, 0);
      mergeIntentsFlows(db);
      return written;
    });
    const failed = results.flatMap((result, i) => (result.status === "rejected" ? [`${sources[i]![0]}: ${String(result.reason)}`] : []));
    if (failed.length > 0) throw new Error(`${failed.length} of ${sources.length} series failed (${rows} rows saved): ${failed.join("; ")}`);
    return rows;
  },
};

/** Coin price series the coin price job keeps, each with its CoinGecko id. */
const PRICE_HISTORY: Array<[SeriesName, string]> = [
  [SERIES.nearPriceHistoryUsd, PRICE_HISTORY_COINS.near],
  [SERIES.btcPriceUsd, PRICE_HISTORY_COINS.btc],
  [SERIES.ethPriceUsd, PRICE_HISTORY_COINS.eth],
];

/** Daily BTC, ETH and NEAR prices from DefiLlama's coins API for the lead-lag test: the first run backfills from
    COIN_PRICE_HISTORY_START, later runs read back COIN_PRICE_REFRESH_DAYS from each series' newest day.
    Coins already read are saved when a later one fails. */
export const coinPricesJob: Job = {
  name: JOBS.coinPrices,
  everyMs: INGEST_SCHEDULE_MS.coinPrices,
  async run(db) {
    const newest = db.prepare("SELECT MAX(day) AS day FROM daily_series WHERE series = ?");
    const fetched: Array<[SeriesName, DayValue[]]> = [];
    let failure: unknown = null;
    for (const [series, coinId] of PRICE_HISTORY) {
      const last = newest.get(series)?.day;
      const from = last == null ? COIN_PRICE_HISTORY_START : addDays(String(last), -COIN_PRICE_REFRESH_DAYS);
      try {
        fetched.push([series, (await fetchCoinPriceHistory(coinId, from)).filter((point) => point.day <= today())]);
      } catch (error) {
        failure = error;
        break;
      }
    }
    const rows = transaction(db, () => fetched.reduce((sum, [series, points]) => sum + upsertSeries(db, series, points), 0));
    if (failure) throw new Error(`stopped after ${fetched.length} of ${PRICE_HISTORY.length} coins (${rows} rows saved): ${errorMessage(failure)}`);
    return rows;
  },
};
