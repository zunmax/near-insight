import { io } from "next/cache";
import { BarList, BarListSkeleton } from "@/components/charts/BarList";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { PEER_SUPPLY_GROWTH, PEG_CHANGE_1Y, PEG_PRICE_BAND } from "@/config/peers";
import { getNearAndPeers, getSupplyGrowth1y, getSupplyGrowthThrough } from "@/data/market";
import { formatChange, formatPercent } from "@/lib/format";

const TITLE = "Circulating supply growth, 12 months";
const { minHistoryDays } = PEER_SUPPLY_GROWTH;

/** Yearly circulating-supply growth of NEAR and every coin ranked above it, fastest first. */
export async function SupplyGrowthPeersPanel() {
  await io();
  const [market, growth, through] = await Promise.all([getNearAndPeers(), getSupplyGrowth1y(), getSupplyGrowthThrough()]);
  if (!market || growth.size === 0) return <NoData title={TITLE} />;
  const rows = [...market.peers, market.near]
    .flatMap((coin) => (growth.has(coin.id) ? [{ label: coin.name, value: growth.get(coin.id)!, highlight: coin.id === "near" }] : []))
    .sort((a, b) => b.value - a.value)
    .map((row) => ({ ...row, display: formatChange(row.value, 1) }));

  return (
    <Panel
      title={TITLE}
      description={`The peer median the breaking point uses leaves out dollar-pegged coins (stablecoins and tokenized cash or credit funds): coins priced within ${formatPercent(PEG_PRICE_BAND, 0)} of $1 that moved less than ${PEG_CHANGE_1Y}% in a year. Their supply follows deposits or lending, not issuance. Every coin with at least ${minHistoryDays} days of supply history is still listed below.`}
      sources={["coingecko"]}
      through={through ? `Data through ${through}` : undefined}
      sqlId="peer-supply-growth"
    >
      <BarList rows={rows} caption="Circulating supply growth over 12 months for NEAR and the coins ranked above it" />
    </Panel>
  );
}

/** Loading placeholder of SupplyGrowthPeersPanel: a bar for NEAR and each of the about 20 coins ranked above it. */
export function SupplyGrowthPeersPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={318} tabs="Chart">
      <BarListSkeleton rows={21} />
    </PanelSkeleton>
  );
}
