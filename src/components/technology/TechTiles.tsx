import { io } from "next/cache";
import { connection } from "next/server";
import { NoData } from "@/components/ui/NoData";
import { StatTile, StatTileSkeleton } from "@/components/ui/StatTile";
import { SHARD_CAP } from "@/config/protocol";
import { FINALITY_SECONDS } from "@/content/facts";
import { getLiveSnapshot } from "@/data/live";
import { getNetworkState } from "@/data/network";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatDateTimeUtc } from "@/lib/format";
import { transferCost } from "@/lib/thesis/triggers";

export async function TechTiles() {
  await io();
  const [network, { technology }] = await Promise.all([getNetworkState(), getThesisMetrics()]);
  if (!network || !technology) return <NoData title="Technology" />;
  await connection();
  const live = getLiveSnapshot();
  const readAt = `Read ${formatDateTimeUtc(network.fetchedAt)}`;

  return (
    <>
      <StatTile
        label="Shards"
        icon="grid"
        value={String(network.shardCount)}
        detail={`Shards split as state grows, up to ${SHARD_CAP}; most validators hold no state`}
        sources={["nearRpc"]}
        through={readAt}
      />
      <StatTile
        label="Transfer cost"
        icon="coin"
        value={transferCost(technology.transferCostUsd)}
        detail={`${technology.transferCostNear.toPrecision(3)} NEAR at the gas price read on ${formatDateTimeUtc(technology.gasPriceReadAt)}`}
        sources={["nearRpc", "coingecko"]}
        through={readAt}
      />
      <StatTile
        label="Finality"
        icon="clock"
        value={`${FINALITY_SECONDS.value} s`}
        detail={live?.blockTimeSeconds == null ? undefined : `Blocks every ${live.blockTimeSeconds.toFixed(2)} s over the last ${Math.round(live.blockSpanMinutes)} min`}
        sources={live?.blockTimeSeconds == null ? [{ cite: FINALITY_SECONDS.source }] : [{ cite: FINALITY_SECONDS.source }, "nearRpc"]}
      />
      <StatTile
        label="Protocol"
        icon="tag"
        value={String(network.protocolVersion)}
        detail={`nearcore ${network.nodeVersion} on mainnet`}
        sources={["nearRpc"]}
        through={readAt}
      />
    </>
  );
}

/** Loading placeholder of TechTiles: the four tiles with their labels' and details' lengths. */
export function TechTilesSkeleton() {
  return (
    <>
      <StatTileSkeleton label={"Shards".length} detail={68} />
      <StatTileSkeleton label={"Transfer cost".length} detail={60} />
      <StatTileSkeleton label={"Finality".length} detail={41} />
      <StatTileSkeleton label={"Protocol".length} detail={26} />
    </>
  );
}
