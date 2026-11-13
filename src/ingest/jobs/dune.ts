/** Dune job: NEAR Intents volume, swaps, fees, fees by channel, volume by chain and token, and TVL from the NEAR team's dashboard. */
import type { DatabaseSync } from "node:sqlite";
import { INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { SOURCES } from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, SERIES, type SeriesName } from "../../db/schema.ts";
import { errorMessage, ShapeError } from "../../lib/validate.ts";
import { addDays, type DayValue } from "../days.ts";
import {
  fetchDuneResults,
  readFeeChannels,
  readFees,
  readSwaps,
  readTvl,
  readVolume,
  readVolumeBy,
  runDay,
  type DuneRows,
} from "../sources/dune.ts";
import type { Job } from "./job.ts";
import { mergeIntentsFlows } from "./merge-intents.ts";
import { datasetVersion, markDatasetVersion, replaceSeries } from "./storage.ts";

type QueryName = keyof typeof SOURCES.dune.queries;

/** dataset_versions row holding the id of a query's run already stored, so an unchanged run is not read again. */
const runDataset = (queryId: number) => `dune_query_${queryId}`;

/** dataset_versions row holding the signing key found in dune.com's web client, once it differs from SOURCES.dune.signingKey. */
const SIGNING_KEY_DATASET = "dune_signing_key";

/** First and last stored day of a series or table; both null while nothing is stored. */
type StoredSpan = { first: unknown; last: unknown } | undefined;

/** Throws unless a run's finished rows cover every day already stored from that query (each query returns its whole
    history), so an empty or shorter result (a reshaped or filtered query, an older run) keeps the stored rows. */
function requireCoversStored(stored: StoredSpan, rows: Array<{ day: string }>, query: string) {
  const days = rows.map((row) => row.day).sort();
  const [oldest, newest] = [days[0], days.at(-1)];
  const [first, last] = [stored?.first, stored?.last].map((day) => (day == null ? null : String(day)));
  if (!oldest || !newest || (last && newest < last) || (first && oldest > first)) {
    throw new ShapeError(`${query}.rows`, `finished days from ${first ?? "any day"} through ${last ?? "any day"} (got ${rows.length} rows${oldest ? ` from ${oldest} through ${newest}` : ""})`);
  }
}

/** Replaces a series with a run's finished days, unless they cover less than what is stored. */
function replaceDuneSeries(db: DatabaseSync, series: SeriesName, points: DayValue[], query: string) {
  requireCoversStored(db.prepare("SELECT MIN(day) AS first, MAX(day) AS last FROM daily_series WHERE series = ?").get(series) as StoredSpan, points, query);
  return replaceSeries(db, series, points);
}

/** Replaces every row of a by-day volume table with a run's finished days, unless they cover less than what is stored.
    Rows with the same day and key (one symbol under two contracts) are summed, as the table holds one row per day and key. */
function replaceVolumeTable(
  db: DatabaseSync,
  table: "intents_chain_daily" | "intents_symbol_daily",
  column: "chain" | "symbol",
  rows: Array<{ day: string; key: string; volumeUsd: number }>,
  query: string,
) {
  requireCoversStored(db.prepare(`SELECT MIN(day) AS first, MAX(day) AS last FROM ${table}`).get() as StoredSpan, rows, query);
  const totals = new Map<string, { day: string; key: string; volumeUsd: number }>();
  for (const r of rows) {
    const id = `${r.day}\u0000${r.key}`;
    const total = totals.get(id);
    if (total) total.volumeUsd += r.volumeUsd;
    else totals.set(id, { ...r });
  }
  db.exec(`DELETE FROM ${table}`);
  const insert = db.prepare(`INSERT INTO ${table} (day, ${column}, volume_usd) VALUES (?, ?, ?)`);
  for (const r of totals.values()) insert.run(r.day, r.key, r.volumeUsd);
  return totals.size;
}

/** How each query's rows are stored. Each keeps only the days before the day Dune ran it, since that day was still
    running; Dune rewrites its whole history on each run, so each run replaces what was stored from the query. */
const STORE: Record<QueryName, (db: DatabaseSync, result: DuneRows) => number> = {
  volume: (db, result) => {
    const { total, confidential } = readVolume(result);
    const finished = (day: string) => day < runDay(result);
    return (
      replaceDuneSeries(db, SERIES.duneIntentsVolumeUsd, total.filter((p) => finished(p.day)), "volume") +
      replaceDuneSeries(db, SERIES.intentsConfidentialVolumeUsd, confidential.filter((p) => finished(p.day)), "volume")
    );
  },
  swaps: (db, result) => replaceDuneSeries(db, SERIES.intentsSwaps, readSwaps(result).filter((p) => p.day < runDay(result)), "swaps"),
  /** A run's newest fee day is still filling (2026-11-09 read $57.9K on $166M of volume in the 2026-11-10 run, against
      about 0.15% of volume on other days), so fees keep only the days before it. */
  fees: (db, result) => replaceDuneSeries(db, SERIES.duneIntentsFeesUsd, readFees(result).filter((p) => p.day < addDays(runDay(result), -1)), "fees"),
  feeChannels: (db, result) => {
    const channels = readFeeChannels(result);
    if (channels.length === 0) throw new ShapeError("feeChannels.rows", "at least one channel");
    db.exec("DELETE FROM intents_fee_channels");
    const insert = db.prepare("INSERT INTO intents_fee_channels (channel, fees_usd, as_of) VALUES (?, ?, ?)");
    /** The query sums fees before the day it runs, so totals run through the day before (that day still filling, under 1%
        of the total); one channel name can appear twice, so its rows are summed. */
    const totals = new Map<string, number>();
    for (const c of channels) totals.set(c.channel, (totals.get(c.channel) ?? 0) + c.feesUsd);
    for (const [channel, fees] of totals) insert.run(channel, fees, addDays(runDay(result), -1));
    return totals.size;
  },
  symbolVolume: (db, result) =>
    replaceVolumeTable(db, "intents_symbol_daily", "symbol", readVolumeBy(result, "symbol").filter((r) => r.day < runDay(result)), "symbolVolume"),
  chainVolume: (db, result) =>
    replaceVolumeTable(db, "intents_chain_daily", "chain", readVolumeBy(result, "blockchain").filter((r) => r.day < runDay(result)), "chainVolume"),
  tvl: (db, result) => {
    const { total, confidential } = readTvl(result);
    const finished = (day: string) => day < runDay(result);
    return (
      replaceDuneSeries(db, SERIES.intentsTvlUsd, total.filter((p) => finished(p.day)), "tvl") +
      replaceDuneSeries(db, SERIES.intentsConfidentialTvlUsd, confidential.filter((p) => finished(p.day)), "tvl")
    );
  },
};

/** Dune, every 2 hours: the dashboard's queries, each query's latest finished run, and the rows of every run not stored yet
    (the helper retries each request). Each query is stored on its own, so one failing or reshaped query keeps its last
    stored rows while the others update; Intents volume and fees are then merged with DefiLlama's (mergeIntentsFlows). */
export const duneJob: Job = {
  name: JOBS.dune,
  everyMs: INGEST_SCHEDULE_MS.dune,
  async run(db) {
    const queries = Object.entries(SOURCES.dune.queries) as Array<[QueryName, number]>;
    const known = new Map(queries.flatMap(([, id]) => {
      const executionId = datasetVersion(db, runDataset(id));
      return executionId === null ? [] : [[id, executionId] as const];
    }));
    const signingKey = datasetVersion(db, SIGNING_KEY_DATASET) ?? SOURCES.dune.signingKey;
    const run = await fetchDuneResults(
      queries.map(([, id]) => id),
      known,
      signingKey,
    );
    if (run.signingKey !== signingKey) transaction(db, () => markDatasetVersion(db, SIGNING_KEY_DATASET, run.signingKey));

    let rows = 0;
    const failures: string[] = [];
    for (const [name, id] of queries) {
      const result = run.results.get(id);
      if (!result || "error" in result) {
        failures.push(`${name} (query ${id}): ${result ? result.error : "no result"}`);
        continue;
      }
      if (result.unchanged) continue;
      try {
        rows += transaction(db, () => {
          const written = STORE[name](db, result);
          markDatasetVersion(db, runDataset(id), result.executionId);
          return written;
        });
      } catch (error) {
        failures.push(`${name} (query ${id}): ${errorMessage(error)}`);
      }
    }
    transaction(db, () => mergeIntentsFlows(db));
    if (failures.length > 0) throw new Error(`${failures.length} of ${queries.length} queries failed (${rows} rows saved): ${failures.join("; ")}`);
    return rows;
  },
};
