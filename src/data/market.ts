import "server-only";
import { cacheLife } from "next/cache";
import { PEER_SUPPLY_GROWTH } from "@/config/peers";
import { getReader } from "@/data/reader";
import { SERIES } from "@/db/schema";
import { DAY_SECONDS, dayTime, yearlyGrowthOfMedians, type DailyPoint } from "@/lib/metrics";

export type CoinMarket = {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number | null;
  athUsd: number | null;
  /** Price change over one year, in percent. */
  change1y: number | null;
};

const nullableNumber = (value: unknown) => (value === null ? null : Number(value));

const { minHistoryDays: MIN_HISTORY_DAYS, endDays: SUPPLY_END_DAYS } = PEER_SUPPLY_GROWTH;

/** Yearly circulating-supply growth per coin id from coin_supply_daily (yearlyGrowthOfMedians over SUPPLY_END_DAYS
    at each end); coins with less than MIN_HISTORY_DAYS of history are left out. */
export async function getSupplyGrowth1y(): Promise<Map<string, number>> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  const growth = new Map<string, number>();
  if (!db) return growth;
  const byCoin = new Map<string, DailyPoint[]>();
  for (const row of db.prepare("SELECT coin_id, day, circulating_supply FROM coin_supply_daily ORDER BY coin_id, day").all()) {
    const points = byCoin.get(String(row.coin_id)) ?? [];
    points.push({ time: dayTime(String(row.day)), value: Number(row.circulating_supply) });
    byCoin.set(String(row.coin_id), points);
  }
  for (const [coin, points] of byCoin) {
    const history = (points.at(-1)!.time - points[0]!.time) / DAY_SECONDS;
    const change = history >= MIN_HISTORY_DAYS ? yearlyGrowthOfMedians(points, SUPPLY_END_DAYS) : null;
    if (change !== null) growth.set(coin, change);
  }
  return growth;
}

/** Last day of NEAR's stored circulating supply history, where its 12-month supply growth ends; null before the first read. */
export async function getSupplyGrowthThrough(): Promise<string | null> {
  "use cache";
  cacheLife("db");
  const day = getReader()?.prepare("SELECT MAX(day) AS day FROM coin_supply_daily WHERE coin_id = 'near'").get()?.day;
  return day == null ? null : String(day);
}

/** NEAR's daily market cap in USD: CoinGecko circulating supply × that day's NEAR price, oldest first. */
export async function getNearMarketCapHistory(): Promise<DailyPoint[]> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return [];
  return db
    .prepare(
      `SELECT s.day, s.circulating_supply * p.value AS market_cap
       FROM coin_supply_daily s JOIN daily_series p ON p.series = ? AND p.day = s.day
       WHERE s.coin_id = 'near' ORDER BY s.day`,
    )
    .all(SERIES.nearPriceUsd)
    .map((r) => ({ time: dayTime(String(r.day)), value: Number(r.market_cap) }));
}

/** NEAR's latest market row plus every coin ranked above it, or null before the first ingest. */
export async function getNearAndPeers(): Promise<{ near: CoinMarket; peers: CoinMarket[]; fetchedAt: string } | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;

  const rows = db.prepare("SELECT * FROM coins_latest ORDER BY rank").all();
  const coins = rows.map(
    (r): CoinMarket => ({
      id: String(r.coin_id),
      symbol: String(r.symbol),
      name: String(r.name),
      rank: Number(r.rank),
      priceUsd: Number(r.price_usd),
      marketCapUsd: Number(r.market_cap_usd),
      fdvUsd: nullableNumber(r.fdv_usd),
      athUsd: nullableNumber(r.ath_usd),
      change1y: nullableNumber(r.change_1y),
    }),
  );
  const near = coins.find((coin) => coin.id === "near");
  if (!near) return null;
  return {
    near,
    peers: coins.filter((coin) => coin.rank < near.rank),
    fetchedAt: String(rows[0]?.fetched_at ?? ""),
  };
}
