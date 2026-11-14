/** The peers section: NEAR's circulating supply growth against larger coins, and its FDV ÷ market cap. */
import { COINGECKO, COINGECKO_MARKETS, daysTo, EPOCH_HEADERS, NEARBLOCKS_V1, NEARBLOCKS_V3, reading, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { SOURCES } from "@/config/sources";
import { formatChange, formatCount, formatMultiple } from "@/lib/format";
import { peerDigits } from "@/lib/thesis/triggers";

export function peersSection(input: ThesisDocumentInput): string {
  const { peers: p, market } = input.metrics;
  const coins = p && p.count > 0 ? p : null;
  const lastDay = daysTo(365, p?.through ?? null);
  const digits = coins ? peerDigits(coins) : 1;
  return section(
    "peers",
    input,
    [
      ["NEAR circulating supply growth (CoinGecko market cap ÷ price)", show(coins?.nearGrowth1y, (v) => formatChange(v, digits)), lastDay],
      [
        coins
          ? `Median circulating supply growth of the ${formatCount(coins.count, "larger coin")} with a year of history, not dollar-pegged`
          : "Median circulating supply growth of the larger coins with a year of history, not dollar-pegged",
        show(coins?.medianGrowth1y, (v) => formatChange(v, digits)),
        lastDay,
      ],
      ["FDV ÷ market cap for NEAR", show(market?.fdvRatio, (v) => formatMultiple(v, 2)), reading(input.marketAsOf)],
    ],
    [],
    `CoinGecko \`GET ${COINGECKO_MARKETS}\` (\`fully_diluted_valuation\` ÷ \`market_cap\`; \`current_price\` and \`price_change_percentage_1y_in_currency\` leave out dollar-pegged coins) and \`GET ${COINGECKO}/coins/{id}/market_chart?vs_currency=usd&days=365&interval=daily\` (\`market_caps\` ÷ \`prices\`; the public API serves at most 365 days); ${EPOCH_HEADERS} (NEAR minted); NearBlocks \`GET ${NEARBLOCKS_V3}/block-stats?limit=${SOURCES.nearblocks.maxDailyRows}\` and \`GET ${NEARBLOCKS_V1}/charts\` (total supply at the window's start, for NEAR minted as a share of supply).`,
  );
}
