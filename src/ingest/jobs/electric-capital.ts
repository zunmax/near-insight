/** Electric Capital job: monthly active developers for NEAR, Ethereum, Solana and Bitcoin. */
import { INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, SERIES } from "../../db/schema.ts";
import { fetchDeveloperSnapshot } from "../sources/electric-capital.ts";
import type { Job } from "./job.ts";
import { datasetVersion, markDatasetVersion, upsertSeries } from "./storage.ts";

/** dataset_versions row holding the snapshot version already stored, so an unchanged snapshot is skipped. */
const DEVELOPERS_DATASET = "eco_mads";

export const developersJob: Job = {
  name: JOBS.developers,
  everyMs: INGEST_SCHEDULE_MS.developers,
  async run(db) {
    const snapshot = await fetchDeveloperSnapshot(datasetVersion(db, DEVELOPERS_DATASET));
    if (!snapshot) return 0;
    return transaction(db, () => {
      const rows =
        upsertSeries(db, SERIES.devsAllNear, snapshot.series.near.all) +
        upsertSeries(db, SERIES.devsFullTimeNear, snapshot.series.near.fullTime) +
        upsertSeries(db, SERIES.devsAllEthereum, snapshot.series.ethereum.all) +
        upsertSeries(db, SERIES.devsAllSolana, snapshot.series.solana.all) +
        upsertSeries(db, SERIES.devsAllBitcoin, snapshot.series.bitcoin.all);
      markDatasetVersion(db, DEVELOPERS_DATASET, snapshot.version);
      return rows;
    });
  },
};
