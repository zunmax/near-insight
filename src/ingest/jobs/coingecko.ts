/** CoinGecko jobs: top markets, NEAR's price history and the circulating supply of NEAR and the coins ranked above it. */
import { INGEST_SCHEDULE_MS, PAGED_RUN_BUDGET_MS } from "../../config/ingest.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, SERIES } from "../../db/schema.ts";
import { now, today } from "../days.ts";
import { fetchCirculatingSupplyHistory, fetchNearPriceHistory, fetchTopMarkets } from "../sources/coingecko.ts";
import type { Job } from "./job.ts";
import { upsertSeries } from "./storage.ts";

export const marketsJob: Job = {
  name: JOBS.markets,
  everyMs: INGEST_SCHEDULE_MS.markets,
  async run(db) {
    const coins = await fetchTopMarkets();
    const fetchedAt = now();
    const day = today();
    return transaction(db, () => {
      db.exec("DELETE FROM coins_latest");
      const latest = db.prepare(
        `INSERT INTO coins_latest (coin_id, symbol, name, rank, price_usd, market_cap_usd, fdv_usd, circulating_supply,
           total_supply, max_supply, ath_usd, ath_date, change_1y, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      /** A day's row keeps its first reading, taken just after 00:00 UTC like every other stored daily price. */
      const daily = db.prepare(
        `INSERT INTO coins_daily (day, coin_id, rank, price_usd, market_cap_usd, fdv_usd) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (day, coin_id) DO NOTHING`,
      );
      for (const c of coins) {
        latest.run(c.id, c.symbol, c.name, c.rank, c.priceUsd, c.marketCapUsd, c.fdvUsd, c.circulatingSupply, c.totalSupply,
          c.maxSupply, c.athUsd, c.athDate, c.change1y, fetchedAt);
        daily.run(day, c.id, c.rank, c.priceUsd, c.marketCapUsd, c.fdvUsd);
      }
      const near = coins.find((c) => c.id === "near");
      const priceRows = near ? upsertSeries(db, SERIES.nearPriceUsd, [{ day, value: near.priceUsd }]) : 0;
      return coins.length * 2 + priceRows;
    });
  },
};

export const nearPriceJob: Job = {
  name: JOBS.nearPrice,
  everyMs: INGEST_SCHEDULE_MS.nearPrice,
  async run(db) {
    const points = await fetchNearPriceHistory();
    return transaction(db, () => upsertSeries(db, SERIES.nearPriceUsd, points));
  },
};

/** Circulating-supply history of NEAR and every coin ranked above it, one paced CoinGecko call per coin, NEAR first. Each coin is saved
    as it arrives and a coin already stored today is skipped, so a run that fails or reaches PAGED_RUN_BUDGET_MS
    leaves the coins it read stored, and the retry reads only the rest. */
export const peerSupplyJob: Job = {
  name: JOBS.peerSupply,
  everyMs: INGEST_SCHEDULE_MS.peerSupply,
  async run(db) {
    const near = db.prepare("SELECT rank FROM coins_latest WHERE coin_id = 'near'").get();
    if (!near) throw new Error("coins_latest has no NEAR row yet; the markets job runs first");
    const coins = db
      .prepare(
        `SELECT c.coin_id FROM coins_latest c
         WHERE c.rank <= ? AND COALESCE((SELECT MAX(day) FROM coin_supply_daily s WHERE s.coin_id = c.coin_id), '') < ?
         ORDER BY c.coin_id <> 'near', c.rank`,
      )
      .all(Number(near.rank), today())
      .map((r) => String(r.coin_id));
    const stmt = db.prepare(
      `INSERT INTO coin_supply_daily (coin_id, day, circulating_supply) VALUES (?, ?, ?)
       ON CONFLICT (coin_id, day) DO UPDATE SET circulating_supply = excluded.circulating_supply`,
    );
    const deadline = Date.now() + PAGED_RUN_BUDGET_MS;
    let rows = 0;
    for (const [i, coin] of coins.entries()) {
      if (Date.now() >= deadline) throw new Error(`stopped after ${i} of ${coins.length} coins at the run budget; the retry reads the rest`);
      const points = await fetchCirculatingSupplyHistory(coin);
      rows += transaction(db, () => {
        for (const point of points) stmt.run(coin, point.day, point.value);
        return points.length;
      });
    }
    return rows;
  },
};
