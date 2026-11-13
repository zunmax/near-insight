/** Thesis section 5: finality, block time, protocol upgrades, transfer cost and the dated technology facts. */
import { COINGECKO_MARKETS, DASH, day, EPOCH_HEADERS, factTable, GITHUB, reading, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { TRANSFER_TGAS } from "@/config/protocol";
import { ACCOUNT_FACTS, FINALITY_SECONDS, TECHNOLOGY_FACTS } from "@/content/facts";
import type { Release } from "@/db/schema";
import { formatUsd } from "@/lib/format";
import { transferCost } from "@/lib/thesis/triggers";
import { DAY_SECONDS, dayTime, YEAR_SECONDS } from "@/lib/metrics";

/** Stable nearcore releases that open a new minor version (x.y.0) in the 365 days to `snapshot`, oldest first; null when the stored releases start later. */
function minorReleases(releases: Release[], snapshot: string): string[] | null {
  const start = new Date((dayTime(snapshot) + DAY_SECONDS - YEAR_SECONDS) * 1000).toISOString();
  const oldest = releases.at(-1);
  if (!oldest || oldest.publishedAt > start) return null;
  return releases
    .filter((r) => !r.prerelease && /^\d+\.\d+\.0$/.test(r.tag) && r.publishedAt >= start)
    .map((r) => r.tag)
    .reverse();
}

export function technologySection(input: ThesisDocumentInput): string {
  const { technology, protocol, market } = input.metrics;
  const { network, live } = input;
  const upgrades = minorReleases(input.releases, input.snapshot);
  return section(
    5,
    "technology",
    input,
    [
      ["Time to finality", `~${FINALITY_SECONDS.value} s, deterministic`, FINALITY_SECONDS.source],
      [
        "Block time, measured from block heights and timestamps",
        show(live?.blockTimeSeconds, (s) => `~${s.toFixed(1)} s`),
        live ? `average over the last ${Math.round(live.blockSpanMinutes)} minutes of samples, ${day(live.at)}` : DASH,
      ],
      [
        "Protocol upgrades shipped: stable nearcore releases with a new minor version (x.y.0)",
        upgrades ? `${upgrades.length}${upgrades.length > 0 ? `: ${upgrades.join(", ")}` : ""}` : DASH,
        `365 days to ${input.snapshot}`,
      ],
      [
        `Simple transfer (${TRANSFER_TGAS} Tgas)`,
        technology ? `${technology.transferCostNear.toPrecision(3)} NEAR (${transferCost(technology.transferCostUsd)})` : DASH,
        `gas price ${reading(network?.fetchedAt)}, NEAR price ${reading(input.marketAsOf)}`,
      ],
      ["Shards", show(network?.shardCount, String), reading(network?.fetchedAt)],
      ["Protocol version", protocol ? `mainnet ${protocol.mainnet}, testnet ${protocol.testnet}` : DASH, reading(protocol?.fetchedAt)],
      ["nearcore on mainnet", show(network?.nodeVersion, String), reading(network?.fetchedAt)],
      ["NEAR price", show(market?.priceUsd, formatUsd), reading(input.marketAsOf)],
    ],
    [
      "A nearcore release reaches mainnet once validators upgrade to it.",
      `Dated facts that no free API returns, each with its source:\n\n${factTable(TECHNOLOGY_FACTS)}`,
      `NEAR account features, from docs.near.org:\n\n${factTable(ACCOUNT_FACTS)}`,
    ],
    `NEAR RPC \`block\` with \`{"finality":"final"}\` (\`gas_price\`; the worker also samples the latest final block's height and time every minute, for the block time), \`EXPERIMENTAL_protocol_config\` (\`shard_layout\`) and \`status\` on mainnet and testnet (protocol and nearcore versions); \`GET ${GITHUB}/repos/near/nearcore/releases?per_page=50\`; CoinGecko \`GET ${COINGECKO_MARKETS}\` (NEAR price, for the transfer cost in USD); ${EPOCH_HEADERS} (NEAR burned and minted).`,
  );
}
