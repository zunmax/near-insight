/** NEAR's market figures and its circulating-supply growth and FDV against the coins ranked above it. */
import { LOCKED_SUPPLY_MARGIN, PEG_CHANGE_1Y, PEG_PRICE_BAND } from "@/config/peers";
import type { CoinMarket } from "@/data/market";
import { median } from "@/lib/metrics";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

/** FDV ÷ market cap; null when CoinGecko gives no FDV. */
const fdvRatio =(coin: CoinMarket) => (coin.fdvUsd ? coin.fdvUsd / coin.marketCapUsd : null);

/** Whether a coin has supply not yet circulating (locked, unvested or not yet mined): FDV above market cap beyond rounding. */
const hasLockedSupply = (coin: CoinMarket) => coin.fdvUsd !== null && coin.fdvUsd > coin.marketCapUsd * (1 + LOCKED_SUPPLY_MARGIN);

const isDollarPegged = (coin: CoinMarket) => coin.change1y !== null && Math.abs(coin.change1y) < PEG_CHANGE_1Y && Math.abs(coin.priceUsd - 1) < PEG_PRICE_BAND;

export function marketMetrics({ market }: ThesisInputs): ThesisMetrics["market"] {
  const near = market?.near;
  return near ? { priceUsd: near.priceUsd, marketCapUsd: near.marketCapUsd, rank: near.rank, fdvRatio: fdvRatio(near) } : null;
}

export function peersMetrics({ market, supplyGrowth, supplyGrowthThrough }: ThesisInputs): ThesisMetrics["peers"] {
  if (!market) return null;
  /** A pegged coin's FDV above market cap is unissued deposits, not supply waiting to unlock, so it is left out here too. */
  const unpegged = market.peers.filter((coin) => !isDollarPegged(coin));
  const peerGrowth = unpegged.flatMap((coin) => (supplyGrowth.has(coin.id) ? [supplyGrowth.get(coin.id)!] : []));
  const nearGrowth = supplyGrowth.get("near") ?? null;
  return {
    through: supplyGrowthThrough,
    nearGrowth1y: nearGrowth,
    medianGrowth1y: median(peerGrowth),
    count: peerGrowth.length,
    fasterCount: nearGrowth === null ? null : peerGrowth.filter((growth) => growth > nearGrowth).length,
    lockedCount: unpegged.filter(hasLockedSupply).length,
    peerTotal: unpegged.length,
    nearFdvRatio: fdvRatio(market.near),
    nearLocked: hasLockedSupply(market.near),
  };
}
