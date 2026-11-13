import "server-only";
import { cacheLife } from "next/cache";
import { getReader } from "@/data/reader";
import { SERIES, type SeriesName } from "@/db/schema";
import { dayTime, extendBack, type DailyPoint } from "@/lib/metrics";

/** Daily points of a stored series, oldest first; `time` is the UTC day start in unix seconds. */
export async function getSeries(series: SeriesName): Promise<DailyPoint[]> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return [];
  return db
    .prepare("SELECT day, value FROM daily_series WHERE series = ? ORDER BY day")
    .all(series)
    .map((r) => ({ time: dayTime(String(r.day)), value: Number(r.value) }));
}

/** NEAR's daily price for turning flows into NEAR: CoinGecko's, which serves 365 days at most, preceded by the DefiLlama
    price history on earlier days, so buying since buybacks began stays fully priced on a database built later. */
export async function getNearPrices(): Promise<DailyPoint[]> {
  const [prices, history] = await Promise.all([getSeries(SERIES.nearPriceUsd), getSeries(SERIES.nearPriceHistoryUsd)]);
  return extendBack(prices, history);
}
