/** SQLite write helpers shared by the ingest jobs. */
import type { DatabaseSync } from "node:sqlite";
import { LIVE_RETENTION_DAYS } from "../../config/ingest.ts";
import { LIVE, type LiveMetric, type SeriesName } from "../../db/schema.ts";
import { daysAgo, now, type DayValue } from "../days.ts";

/** Every daily series holds amounts, counts, prices or balances, none below zero, so a non-finite or negative day from a
    source is left out: a bad upstream value never replaces a stored one. */
const storable = (points: DayValue[]) => points.filter((point) => Number.isFinite(point.value) && point.value >= 0);

/** Stores each day's value; a day whose value is unchanged is left as it is, so re-reading a full history writes only what changed. */
export function upsertSeries(db: DatabaseSync, series: SeriesName, points: DayValue[]): number {
  const stmt = db.prepare(
    `INSERT INTO daily_series (series, day, value) VALUES (?, ?, ?)
     ON CONFLICT (series, day) DO UPDATE SET value = excluded.value WHERE daily_series.value IS NOT excluded.value`,
  );
  const kept = storable(points);
  for (const point of kept) stmt.run(series, point.day, point.value);
  return kept.length;
}

/** Replaces every stored day of a series with `points`; returns rows written. */
export function replaceSeries(db: DatabaseSync, series: SeriesName, points: DayValue[]): number {
  db.prepare("DELETE FROM daily_series WHERE series = ?").run(series);
  return upsertSeries(db, series, points);
}

/** Writes only the days a series does not have yet; returns rows added. */
export function insertMissingSeries(db: DatabaseSync, series: SeriesName, points: DayValue[]): number {
  const stmt = db.prepare("INSERT INTO daily_series (series, day, value) VALUES (?, ?, ?) ON CONFLICT (series, day) DO NOTHING");
  return storable(points).reduce((rows, point) => rows + Number(stmt.run(series, point.day, point.value).changes), 0);
}

/** The stored version of a dataset (a day it was stored through, a run id, a key), or null when there is none. */
export function datasetVersion(db: DatabaseSync, dataset: string): string | null {
  const version = db.prepare("SELECT version FROM dataset_versions WHERE dataset = ?").get(dataset)?.version;
  return version == null ? null : String(version);
}

export function markDatasetVersion(db: DatabaseSync, dataset: string, version: string) {
  db.prepare(
    `INSERT INTO dataset_versions (dataset, version, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT (dataset) DO UPDATE SET version = excluded.version, fetched_at = excluded.fetched_at`,
  ).run(dataset, version, now());
}

export function insertLive(db: DatabaseSync, at: string, samples: Array<[LiveMetric, number]>): number {
  const stmt = db.prepare("INSERT OR REPLACE INTO live_samples (metric, at, value) VALUES (?, ?, ?)");
  for (const [metric, value] of samples) stmt.run(metric, at, value);
  return samples.length;
}

/** Deletes samples older than LIVE_RETENTION_DAYS, one metric at a time, so each delete is a range on the (metric, at) key. */
export function pruneLive(db: DatabaseSync) {
  const stmt = db.prepare("DELETE FROM live_samples WHERE metric = ? AND at < ?");
  const before = daysAgo(LIVE_RETENTION_DAYS);
  for (const metric of Object.values(LIVE)) stmt.run(metric, before);
}
