import { SOURCES } from "../../config/sources.ts";
import { DAY_SECONDS, dayTime, isoDay } from "../../lib/metrics.ts";
import { asArray, asRecord, readDailySeries, readNumber, readPositiveNumber, ShapeError } from "../../lib/validate.ts";
import type { DayValue } from "../days.ts";
import { fetchJson } from "../http.ts";

/** Daily values from a DefiLlama summary (one protocol) or overview (one chain) endpoint, dexs or fees. */
async function fetchSummaryDaily(path: string): Promise<DayValue[]> {
  const body = asRecord(await fetchJson(`${SOURCES.defillama.baseUrl}${path}`), path);
  return readDailySeries(body.totalDataChart, `${path}.totalDataChart`).map((p) => ({ day: isoDay(p.time), value: p.value }));
}

/** NEAR Intents swap volume (USD per day). */
export const fetchIntentsVolume = () => fetchSummaryDaily("/summary/dexs/near-intents?excludeTotalDataChartBreakdown=true");

/** NEAR Intents revenue spent on NEAR buybacks (USD per day; starts 2026-02-23). */
export const fetchIntentsBuybacks = () =>
  fetchSummaryDaily("/summary/fees/near-intents?dataType=dailyHoldersRevenue&excludeTotalDataChartBreakdown=true");

/** NEAR Intents gross fees: protocol fee plus every front end's fee (USD per day). */
export const fetchIntentsFees = () => fetchSummaryDaily("/summary/fees/near-intents?dataType=dailyFees&excludeTotalDataChartBreakdown=true");

/** NEAR Intents revenue: the share of fees the app operators keep, swept into their revenue wallets (USD per day). */
export const fetchIntentsRevenue = () =>
  fetchSummaryDaily("/summary/fees/near-intents?dataType=dailyRevenue&excludeTotalDataChartBreakdown=true");

/** Volume of every DEX DefiLlama tracks on NEAR, NEAR Intents included (USD per day). */
export const fetchNearDexVolume = () => fetchSummaryDaily("/overview/dexs/near?excludeTotalDataChartBreakdown=true");

/** Gas fees paid on NEAR L1 (USD per day). */
export const fetchNearChainFees = () => fetchSummaryDaily("/summary/fees/near?excludeTotalDataChartBreakdown=true");

/** Daily USD price of a coin (CoinGecko id) from DefiLlama's coins API, from `fromDay` to today, in requests of at most
    `coinsMaxPoints` days. Points sit a few seconds either side of 00:00 UTC; each is labelled with the day of that midnight. */
export async function fetchCoinPriceHistory(coinGeckoId: string, fromDay: string): Promise<DayValue[]> {
  const { coinsUrl, coinsMaxPoints } = SOURCES.defillama;
  const key = `coingecko:${coinGeckoId}`;
  const path = `/chart/${key}`;
  const now = Date.now() / 1000;
  const prices = new Map<string, number>();
  for (let start = dayTime(fromDay); start <= now; start += coinsMaxPoints * DAY_SECONDS) {
    const body = asRecord(await fetchJson(`${coinsUrl}${path}?start=${start}&span=${coinsMaxPoints}&period=1d&searchWidth=600`), path);
    const coin = asRecord(body.coins, `${path}.coins`)[key];
    /** Only a window starting within the last day can be empty; an older one would leave a gap no later run reads again. */
    if (coin === undefined) {
      if (start < now - DAY_SECONDS) throw new ShapeError(`${path}?start=${start}`, "prices for a window that has already passed");
      continue;
    }
    asArray(asRecord(coin, `${path}.coins`).prices, `${path}.prices`).forEach((row, i) => {
      const r = asRecord(row, `${path}.prices[${i}]`);
      const midnight = Math.round(readNumber(r, "timestamp", `${path}.prices[${i}]`) / DAY_SECONDS) * DAY_SECONDS;
      prices.set(isoDay(midnight), readPositiveNumber(r, "price", `${path}.prices[${i}]`));
    });
  }
  return [...prices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
}

/** DeFi TVL on NEAR (USD, daily). */
export async function fetchNearTvl(): Promise<DayValue[]> {
  const path = "/v2/historicalChainTvl/Near";
  return asArray(await fetchJson(`${SOURCES.defillama.baseUrl}${path}`), path).map((row, i) => {
    const r = asRecord(row, `${path}[${i}]`);
    return { day: isoDay(readNumber(r, "date", `${path}[${i}]`)), value: readNumber(r, "tvl", `${path}[${i}]`) };
  });
}

/** USD-pegged stablecoins circulating on NEAR (daily). */
export async function fetchNearStablecoins(): Promise<DayValue[]> {
  const path = "/stablecoincharts/Near";
  return asArray(await fetchJson(`${SOURCES.defillama.stablecoinsUrl}${path}`), path).map((row, i) => {
    const at = `${path}[${i}]`;
    const r = asRecord(row, at);
    const circulating = asRecord(r.totalCirculatingUSD, `${at}.totalCirculatingUSD`);
    const date = Number(r.date);
    if (!Number.isFinite(date)) throw new ShapeError(`${at}.date`, "unix seconds as a number or numeric string");
    return { day: isoDay(date), value: readNumber(circulating, "peggedUSD", `${at}.totalCirculatingUSD`) };
  });
}
