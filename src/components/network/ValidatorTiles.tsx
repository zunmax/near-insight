import { io } from "next/cache";
import { NoData } from "@/components/ui/NoData";
import { StatTile, StatTileSkeleton } from "@/components/ui/StatTile";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatCount, formatNear, formatUsd } from "@/lib/format";

export async function ValidatorTiles() {
  await io();
  const { staking, market } = await getThesisMetrics();
  if (!staking || !market) return <NoData title="Validators" />;
  const usd = (near: number) => formatUsd(near * market.priceUsd);
  const epoch = `Validator set of epoch ${staking.epochHeight}`;
  return (
    <>
      <StatTile
        label="Active validators"
        icon="server"
        value={String(staking.validators)}
        detail={`${staking.producers} ${staking.producers === 1 ? "produces" : "produce"} blocks · epoch ${staking.epochHeight}`}
        sources={["nearRpc"]}
        through={epoch}
      />
      <StatTile
        label="Nakamoto coefficient"
        icon="shield"
        value={String(staking.nakamoto)}
        detail="Fewest validators (staking pools) that together hold more than a third of stake"
        sources={["nearRpc"]}
        through={epoch}
      />
      <StatTile
        label="Chunk-validator seat"
        icon="seat"
        value={formatNear(staking.chunkValidatorSeatNear)}
        detail={`About ${usd(staking.chunkValidatorSeatNear)}: the smallest stake the protocol accepts for a chunk validator`}
        sources={["nearRpc", "coingecko"]}
        through={epoch}
      />
      <StatTile
        label="Block-producer seat"
        icon="cube"
        value={staking.blockProducerSeatNear === null ? "—" : formatNear(staking.blockProducerSeatNear)}
        detail={staking.blockProducerSeatNear === null ? "Not available" : `About ${usd(staking.blockProducerSeatNear)}: the smallest stake among the ${formatCount(staking.producers, "block producer")}`}
        sources={["nearRpc", "coingecko"]}
        through={epoch}
      />
    </>
  );
}

/** Loading placeholder of ValidatorTiles: the four tiles with their labels' and details' lengths. */
export function ValidatorTilesSkeleton() {
  return (
    <>
      <StatTileSkeleton label={"Active validators".length} detail={31} />
      <StatTileSkeleton label={"Nakamoto coefficient".length} detail={79} />
      <StatTileSkeleton label={"Chunk-validator seat".length} detail={76} />
      <StatTileSkeleton label={"Block-producer seat".length} detail={61} />
    </>
  );
}
