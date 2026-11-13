import "server-only";
import { cacheLife } from "next/cache";
import { INGEST_SCHEDULE_MS } from "@/config/ingest";
import { SOURCES, type SourceKey } from "@/config/sources";
import { getReader } from "@/data/reader";
import { SERIES } from "@/db/schema";

/** How fresh one source's data is: how often the worker reads it and the newest day of data it has stored. */
type SourceFreshness = { source: string; everyMs: number; through: string | null };

/** Per source, the job that reads it and the newest stored day of its data (one SQL value, a day or an ISO time). Sources
    whose job reads several, such as NEAR RPC, are dated by their main reading. */
const NEWEST: Record<SourceKey, { job: keyof typeof INGEST_SCHEDULE_MS; sql: string }> = {
  coingecko: { job: "markets", sql: "SELECT MAX(day) FROM coins_daily" },
  dune: { job: "dune", sql: `SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.duneIntentsVolumeUsd}'` },
  defillama: { job: "defillama", sql: `SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.intentsBuybacksUsd}'` },
  nearRpc: { job: "network", sql: "SELECT fetched_at FROM network_latest" },
  nearArchive: { job: "epochs", sql: "SELECT MAX(end_time) FROM epoch_supply" },
  nearblocks: { job: "nearblocks", sql: `SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.nearTxns}'` },
  github: { job: "releases", sql: "SELECT MAX(fetched_at) FROM protocol_versions" },
  cryptopanic: { job: "cryptopanicNews", sql: "SELECT MAX(published_at) FROM news_items WHERE source = 'cryptopanic'" },
  chaincatcher: { job: "chaincatcherNews", sql: "SELECT MAX(published_at) FROM news_items WHERE source = 'chaincatcher'" },
  electricCapital: { job: "developers", sql: `SELECT MAX(day) FROM daily_series WHERE series = '${SERIES.devsAllNear}'` },
};

/** Every source with its schedule and the day its stored data runs through (UTC). */
export async function getSourceFreshness(): Promise<SourceFreshness[]> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return [];
  return (Object.keys(SOURCES) as SourceKey[]).map((key) => {
    const { job, sql } = NEWEST[key];
    const value = db.prepare(sql).all()[0];
    const newest = value ? Object.values(value)[0] : null;
    return { source: SOURCES[key].name, everyMs: INGEST_SCHEDULE_MS[job], through: newest == null ? null : String(newest).slice(0, 10) };
  });
}
