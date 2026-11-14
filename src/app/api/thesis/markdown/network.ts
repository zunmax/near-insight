/** The network section: the validator set, the stake needed for a seat and the Nakamoto coefficient. */
import { COINGECKO_MARKETS, DASH, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { formatNear as near, formatPercent, formatUsd } from "@/lib/format";

export function networkSection(input: ThesisDocumentInput): string {
  const { staking, market } = input.metrics;
  const epoch = `epoch ${show(staking?.epochHeight, String)}`;
  return section(
    "network",
    input,
    [
      ["Active validators", staking ? `${staking.validators} (${staking.producers} ${staking.producers === 1 ? "produces" : "produce"} blocks)` : DASH, epoch],
      [
        "Chunk-validator seat: total stake × `minimum_stake_ratio`",
        staking ? `${near(staking.chunkValidatorSeatNear)}${market ? ` (${formatUsd(staking.chunkValidatorSeatNear * market.priceUsd)})` : ""}` : DASH,
        epoch,
      ],
      ["Block-producer seat: the smallest stake among block producers", show(staking?.blockProducerSeatNear, near), epoch],
      ["Nakamoto coefficient: the fewest validators (staking pools) that together hold more than a third of stake", show(staking?.nakamoto, String), epoch],
      ["Staked share of total supply", show(staking?.stakedShare, (v) => formatPercent(v, 1)), epoch],
    ],
    [],
    `NEAR RPC \`validators\` with \`[null]\` (block producers are those with \`num_expected_blocks\` > 0), \`EXPERIMENTAL_protocol_config\` (\`minimum_stake_ratio\`) and \`block\` with \`{"finality":"final"}\` (total supply, for the staked share); CoinGecko \`GET ${COINGECKO_MARKETS}\` (NEAR price, for the seat in USD).`,
  );
}
