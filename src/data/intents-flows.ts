import "server-only";
import { cacheLife } from "next/cache";
import { STABLECOIN_SQL_LIST } from "@/config/intents";
import { getReader } from "@/data/reader";
import { dayTime, type DailyPoint } from "@/lib/metrics";

/** NEAR Intents volume per day, and the part of it in stablecoins. Oldest first. */
type IntentsVolumeMix = { total: DailyPoint[]; stablecoin: DailyPoint[] };

/** One chain's NEAR Intents volume over a window. */
type ChainVolume = { chain: string; volumeUsd: number };

/** Fees one channel (front end, app or referral account) generated since NEAR Intents launched. */
type FeeChannel = { channel: string; feesUsd: number };

/** Daily NEAR Intents volume and its stablecoin part, from the volume by token (Dune). */
export async function getIntentsVolumeMix(): Promise<IntentsVolumeMix> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return { total: [], stablecoin: [] };
  const rows = db
    .prepare(
      `SELECT day, SUM(volume_usd) AS total, SUM(CASE WHEN UPPER(symbol) IN (${STABLECOIN_SQL_LIST}) THEN volume_usd ELSE 0 END) AS stablecoin
       FROM intents_symbol_daily GROUP BY day ORDER BY day`,
    )
    .all();
  return {
    total: rows.map((r) => ({ time: dayTime(String(r.day)), value: Number(r.total) })),
    stablecoin: rows.map((r) => ({ time: dayTime(String(r.day)), value: Number(r.stablecoin) })),
  };
}

/** NEAR Intents volume per chain over the `days` days ending on the newest stored day, largest first; null unless every
    day of the window is stored, so a missing day never prints a short total. */
export async function getChainVolumes(days: number): Promise<{ through: string; chains: ChainVolume[] } | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  const through = db.prepare("SELECT MAX(day) AS day FROM intents_chain_daily").get()?.day;
  if (through == null) return null;
  const stored = db
    .prepare("SELECT COUNT(DISTINCT day) AS days FROM intents_chain_daily WHERE day > date(?, '-' || ? || ' days') AND day <= ?")
    .get(String(through), days, String(through))?.days;
  if (Number(stored) < days) return null;
  const chains = db
    .prepare(
      `SELECT chain, SUM(volume_usd) AS volume FROM intents_chain_daily
       WHERE day > date(?, '-' || ? || ' days') AND day <= ? GROUP BY chain HAVING volume > 0 ORDER BY volume DESC`,
    )
    .all(String(through), days, String(through))
    .map((r) => ({ chain: String(r.chain), volumeUsd: Number(r.volume) }));
  return { through: String(through), chains };
}

/** Chains and tokens with NEAR Intents volume on the newest day both tables have; null while either has no volume that day. */
export async function getIntentsReach(): Promise<{ day: string; chains: number; tokens: number } | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  /** MIN skips a NULL, so an empty table would otherwise name the other table's day and count zero of itself. */
  const row = db
    .prepare(
      `WITH last AS (SELECT CASE WHEN COUNT(d) = 2 THEN MIN(d) END AS day FROM (SELECT MAX(day) AS d FROM intents_chain_daily UNION ALL SELECT MAX(day) FROM intents_symbol_daily))
       SELECT last.day,
         (SELECT COUNT(*) FROM intents_chain_daily c WHERE c.day = last.day AND c.volume_usd > 0) AS chains,
         (SELECT COUNT(*) FROM intents_symbol_daily s WHERE s.day = last.day AND s.volume_usd > 0) AS tokens
       FROM last`,
    )
    .get();
  if (row?.day == null || Number(row.chains) === 0 || Number(row.tokens) === 0) return null;
  return { day: String(row.day), chains: Number(row.chains), tokens: Number(row.tokens) };
}

/** Fees by channel since launch, largest first, and the last day the totals include. */
export async function getFeeChannels(): Promise<{ asOf: string; channels: FeeChannel[] } | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  const rows = db.prepare("SELECT channel, fees_usd, as_of FROM intents_fee_channels WHERE fees_usd > 0 ORDER BY fees_usd DESC").all();
  if (rows.length === 0) return null;
  return { asOf: String(rows[0]!.as_of), channels: rows.map((r) => ({ channel: String(r.channel), feesUsd: Number(r.fees_usd) })) };
}
