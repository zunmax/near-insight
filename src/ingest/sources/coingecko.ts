import { SOURCES } from "../../config/sources.ts";
import { asArray, asRecord, readNumber, readOptionalNumber, readPositiveNumber, readString, ShapeError } from "../../lib/validate.ts";
import { isoDay } from "../../lib/metrics.ts";
import type { DayValue } from "../days.ts";
import { fetchJson, serialGate } from "../http.ts";

/** One CoinGecko call at a time across every job, at least the pacing apart. */
const gate = serialGate(SOURCES.coingecko.pacingMs);

/** GET from CoinGecko, with the optional Demo API key; a retry waits at least the pacing between calls. */
const get = (path: string) => {
  const { baseUrl, apiKey, pacingMs } = SOURCES.coingecko;
  return gate(() => fetchJson(`${baseUrl}${path}`, { headers: apiKey ? { "x-cg-demo-api-key": apiKey } : {} }, pacingMs));
};

type CoinMarket = {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  athUsd: number | null;
  athDate: string | null;
  change1y: number | null;
};

/** Top 100 coins by market cap, with all-time high and 1-year price change. A shorter list, or one without NEAR or with a
    price or market cap at zero, is rejected, because the markets job replaces every stored coin with it. */
export async function fetchTopMarkets(): Promise<CoinMarket[]> {
  const path = `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${SOURCES.coingecko.marketsPageSize}&page=1&price_change_percentage=1y`;
  const rows = asArray(await get(path), "coins/markets");
  const coins = rows.map((row, i) => {
    const at = `coins/markets[${i}]`;
    const r = asRecord(row, at);
    return {
      id: readString(r, "id", at),
      symbol: readString(r, "symbol", at).toUpperCase(),
      name: readString(r, "name", at),
      rank: readNumber(r, "market_cap_rank", at),
      priceUsd: readPositiveNumber(r, "current_price", at),
      marketCapUsd: readPositiveNumber(r, "market_cap", at),
      fdvUsd: readOptionalNumber(r, "fully_diluted_valuation", at),
      circulatingSupply: readNumber(r, "circulating_supply", at),
      totalSupply: readOptionalNumber(r, "total_supply", at),
      maxSupply: readOptionalNumber(r, "max_supply", at),
      athUsd: readOptionalNumber(r, "ath", at),
      athDate: typeof r.ath_date === "string" ? r.ath_date : null,
      change1y: readOptionalNumber(r, "price_change_percentage_1y_in_currency", at),
    };
  });
  const size = SOURCES.coingecko.marketsPageSize;
  if (coins.length < size || !coins.some((c) => c.id === "near")) throw new ShapeError("coins/markets", `${size} coins including NEAR`);
  return coins;
}

/** Daily circulating supply of a coin over the last 365 days (the most CoinGecko's public API serves), as market cap ÷ price
    for each day (the last point of each UTC day wins). Days without a price are left out. */
export async function fetchCirculatingSupplyHistory(coinId: string): Promise<DayValue[]> {
  const path = `coins/${coinId}/market_chart`;
  const body = asRecord(await get(`/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=365&interval=daily`), path);
  const prices = asArray(body.prices, `${path}.prices`);
  const caps = asArray(body.market_caps, `${path}.market_caps`);
  return caps.flatMap((point, i): DayValue[] => {
    const [ms, cap] = asArray(point, `${path}.market_caps[${i}]`);
    const [priceMs, price] = asArray(prices[i] ?? [], `${path}.prices[${i}]`);
    /** The two arrays are paired by position, so a pair whose timestamps differ is left out rather than mixing two days. */
    if (typeof ms !== "number" || priceMs !== ms || typeof cap !== "number" || typeof price !== "number" || price <= 0 || cap <= 0) return [];
    return [{ day: isoDay(ms / 1000), value: cap / price }];
  });
}

/** Daily NEAR price (USD) for the last 365 days. Points are at 00:00 UTC plus one current point;
    the last point of each UTC day wins, so today holds the current price. */
export async function fetchNearPriceHistory(): Promise<DayValue[]> {
  const body = asRecord(await get("/coins/near/market_chart?vs_currency=usd&days=365&interval=daily"), "market_chart");
  return asArray(body.prices, "market_chart.prices").map((point, i) => {
    const [ms, price] = asArray(point, `market_chart.prices[${i}]`);
    if (typeof ms !== "number" || typeof price !== "number" || price <= 0) throw new ShapeError(`market_chart.prices[${i}]`, "[ms, price above zero]");
    return { day: isoDay(ms / 1000), value: price };
  });
}
