import "server-only";
import { LIVE_BLOCKS_WINDOW_MINUTES, LIVE_TXNS_TREND_DAYS } from "@/config/ingest";
import { getReader } from "@/data/reader";
import { LIVE, SERIES, type LiveMetric } from "@/db/schema";

export type LiveSnapshot = {
  at: string;
  blockHeight: number;
  /** Share of the latest block's chunk gas limit that was used. */
  gasUtilization: number;
  /** Average seconds per block over `blockSpanMinutes`, from block heights and their timestamps. */
  blockTimeSeconds: number | null;
  /** Minutes between the first and last block sample the block time spans. */
  blockSpanMinutes: number;
  /** Transactions per minute on the newest finished day (`txnsDay`), from its daily transaction count. */
  txnsPerMinute: number | null;
  txnsDay: string | null;
  /** Transactions per minute on each of the last finished days, oldest first. */
  txnsTrend: Array<{ day: string; perMinute: number }>;
};

type Sample = { at: string; value: number };

function samples(metric: LiveMetric, since: string, until: string): Sample[] {
  return (
    getReader()
      ?.prepare("SELECT at, value FROM live_samples WHERE metric = ? AND at >= ? AND at <= ? ORDER BY at")
      .all(metric, since, until)
      .map((r) => ({ at: String(r.at), value: Number(r.value) })) ?? []
  );
}

/** Time of the newest live sample: the moment the stored data describes. Null before the worker's first sample. Every
    sample stores a block height, so reading that metric alone is one index seek instead of a scan. */
export function latestLiveSampleAt(): string | null {
  const row = getReader()?.prepare("SELECT MAX(at) AS at FROM live_samples WHERE metric = ?").get(LIVE.blockHeight);
  return row?.at == null ? null : String(row.at);
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

const MINUTES_PER_DAY = 24 * 60;

/** Daily NEAR transactions on the last `days` finished days stored up to `endAt`, oldest first. */
function dailyTxns(days: number, endAt: string): Array<{ day: string; value: number }> {
  return (
    getReader()
      ?.prepare("SELECT day, value FROM daily_series WHERE series = ? AND day < ? ORDER BY day DESC LIMIT ?")
      .all(SERIES.nearTxns, endAt.slice(0, 10), days)
      .map((r) => ({ day: String(r.day), value: Number(r.value) }))
      .reverse() ?? []
  );
}

/** Real-time activity from the minute block samples in the LIVE_BLOCKS_WINDOW_MINUTES ending at `endAt` (default now), and
    transactions a minute from the last finished days' counts. Not cached: callers read it per request. Block time needs
    two samples, so it is null right after the worker starts. */
export function getLiveSnapshot(endAt = new Date().toISOString()): LiveSnapshot | null {
  const minutesBefore = (minutes: number) => new Date(Date.parse(endAt) - minutes * 60_000).toISOString();
  const since = minutesBefore(LIVE_BLOCKS_WINDOW_MINUTES);
  const heights = samples(LIVE.blockHeight, since, endAt);
  const gasUsed = samples(LIVE.chunkGasUsed, since, endAt);
  const gasLimit = samples(LIVE.chunkGasLimit, since, endAt);
  const txns = dailyTxns(LIVE_TXNS_TREND_DAYS, endAt);
  const lastHeight = heights.at(-1);
  if (!lastHeight) return null;

  const firstHeight = heights[0]!;
  const blocks = lastHeight.value - firstHeight.value;
  const blockSpanMinutes = minutesBetween(firstHeight.at, lastHeight.at);
  const used = gasUsed.at(-1)?.value ?? 0;
  const limit = gasLimit.at(-1)?.value ?? 0;
  const txnsTrend = txns.map((d) => ({ day: d.day, perMinute: d.value / MINUTES_PER_DAY }));

  return {
    at: lastHeight.at,
    blockHeight: lastHeight.value,
    gasUtilization: limit > 0 ? used / limit : 0,
    blockTimeSeconds: blocks > 0 ? (blockSpanMinutes * 60) / blocks : null,
    blockSpanMinutes,
    txnsPerMinute: txnsTrend.at(-1)?.perMinute ?? null,
    txnsDay: txnsTrend.at(-1)?.day ?? null,
    txnsTrend,
  };
}
