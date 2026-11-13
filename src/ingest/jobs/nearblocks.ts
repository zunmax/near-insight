/** NearBlocks job: daily chain stats, intents.near transactions and tracked balance history. */
import type { DatabaseSync } from "node:sqlite";
import { INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { INTENTS_CONTRACT, SOURCES } from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, SERIES, type SeriesName } from "../../db/schema.ts";
import { addDays, daysBetween, fillDailyBalances, type DayValue } from "../days.ts";
import { errorMessage, ShapeError } from "../../lib/validate.ts";
import { UpstreamError } from "../http.ts";
import { fetchAccountDailyTxns, fetchBalanceChanges, fetchChartHistory, fetchDailyStats, fetchDailyStatsThrough } from "../sources/nearblocks.ts";
import type { Job } from "./job.ts";
import { TRACKED_BALANCES } from "./near.ts";
import { datasetVersion, insertMissingSeries, markDatasetVersion, upsertSeries } from "./storage.ts";

/** dataset_versions row holding the last day the GET /v1/charts history was stored through. */
const NEARBLOCKS_CHARTS_DATASET = "nearblocks_v1_charts";

/** dataset_versions row holding the last day a tracked balance's NearBlocks history was stored through; the network job also writes today's balance into the series. */
const balanceDataset = (series: SeriesName) => `nearblocks_balance_${series}`;

function newestDay(db: DatabaseSync, series: SeriesName): string | null {
  const day = db.prepare("SELECT MAX(day) AS day FROM daily_series WHERE series = ?").get(series)?.day;
  return day == null ? null : String(day);
}

/** True when NearBlocks cannot be reached or rate-limits the run, so the calls left in it would fail the same way. */
const stopsRun = (error: unknown) => error instanceof UpstreamError && (error.status === undefined || error.status === 429);

/** NearBlocks, hourly: each group (chain stats, intents.near transactions, each tracked balance, v1 charts) runs while its stored day
    is behind NearBlocks' last finished day; v3 calls re-read the days since then (365 when empty). Each group saves on its own, and an
    unreachable or rate-limiting NearBlocks ends the run. /v1/charts adds active and new accounts and fills only the days v3 lacks. */
export const nearblocksJob: Job = {
  name: JOBS.nearblocks,
  everyMs: INGEST_SCHEDULE_MS.nearblocks,
  async run(db) {
    let rows = 0;
    const through = await fetchDailyStatsThrough();
    const maxDays = SOURCES.nearblocks.maxDailyRows;
    const daysSince = (stored: string | null) => (stored === null ? maxDays : Math.min(maxDays, Math.max(1, daysBetween(stored, through) + 1)));
    const upTo = (points: DayValue[]) => points.filter((p) => p.day <= through);

    const failures: string[] = [];
    const sync = async (needed: boolean, store: () => Promise<number>) => {
      if (!needed) return;
      try {
        rows += await store();
      } catch (error) {
        if (stopsRun(error)) throw error;
        failures.push(errorMessage(error));
      }
    };

    const chainStored = newestDay(db, SERIES.nearRelayedTxns);
    await sync(chainStored === null || chainStored < through, async () => {
      const chain = await fetchDailyStats(daysSince(chainStored));
      return transaction(
        db,
        () =>
          upsertSeries(db, SERIES.nearTxns, upTo(chain.txns)) +
          upsertSeries(db, SERIES.nearRelayedTxns, upTo(chain.relayedTxns)) +
          upsertSeries(db, SERIES.nearTxnFeesNear, upTo(chain.txnFeesNear)) +
          upsertSeries(db, SERIES.nearTotalSupply, upTo(chain.totalSupplyNear)) +
          upsertSeries(db, SERIES.nearRelayedAccounts, upTo(chain.relayedAccounts)),
      );
    });

    const intentsTxnsStored = newestDay(db, SERIES.intentsTxns);
    await sync(intentsTxnsStored === null || intentsTxnsStored < through, async () => {
      const intentsTxns = await fetchAccountDailyTxns(INTENTS_CONTRACT, daysSince(intentsTxnsStored));
      return transaction(db, () => upsertSeries(db, SERIES.intentsTxns, upTo(intentsTxns)));
    });

    /** Each tracked balance starts on its own first day, or the oldest day NearBlocks serves; one without a row there is backfilled.
        Balance rows exist only on days a balance changed, so asking for as many rows as calendar days always reaches back far enough. */
    const windowStart = addDays(through, 1 - maxDays);
    const firstStored = db.prepare("SELECT MIN(day) AS day FROM daily_series WHERE series = ?");
    for (const { account, series, from } of TRACKED_BALANCES) {
      const start = from > windowStart ? from : windowStart;
      const first = firstStored.get(series)?.day;
      const backfill = first == null || String(first) > start;
      const stored = datasetVersion(db, balanceDataset(series));
      await sync(backfill || stored === null || stored < through, async () => {
        const span = Math.max(1, daysBetween(start, through) + 1);
        const limit = backfill ? span : Math.min(span, daysSince(stored));
        const changes = await fetchBalanceChanges(account, limit);
        /** A tracked account always has a balance row, so an empty reply is a failed read, not a zero balance to store. */
        if (changes.length === 0) throw new ShapeError(`${account} stats/balance`, "at least one balance row");
        const balances = fillDailyBalances(changes, addDays(through, 1 - limit), through, changes.length < limit);
        return transaction(db, () => {
          markDatasetVersion(db, balanceDataset(series), through);
          return upsertSeries(db, series, balances);
        });
      });
    }

    const chartsStored = datasetVersion(db, NEARBLOCKS_CHARTS_DATASET);
    await sync(chartsStored === null || chartsStored < through, async () => {
      const history = await fetchChartHistory();
      return transaction(db, () => {
        markDatasetVersion(db, NEARBLOCKS_CHARTS_DATASET, through);
        return (
          upsertSeries(db, SERIES.nearActiveAccounts, upTo(history.activeAccounts)) +
          upsertSeries(db, SERIES.nearNewAccounts, upTo(history.newAccounts)) +
          insertMissingSeries(db, SERIES.nearTxns, upTo(history.txns)) +
          insertMissingSeries(db, SERIES.nearTxnFeesNear, upTo(history.txnFeesNear)) +
          insertMissingSeries(db, SERIES.nearTotalSupply, upTo(history.totalSupplyNear))
        );
      });
    });

    if (failures.length > 0) throw new Error(failures.join("; "));
    return rows;
  },
};
