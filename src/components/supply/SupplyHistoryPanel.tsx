import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { MILESTONES } from "@/components/charts/milestones";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { SERIES } from "@/db/schema";
import { YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "Total NEAR supply";
const TWO_YEARS = 2 * YEAR_SECONDS;

export async function SupplyHistoryPanel() {
  await io();
  const supply = await getSeries(SERIES.nearTotalSupply);
  const last = supply.at(-1);
  if (!last) return <NoData title={TITLE} />;
  const points = supply.filter((p) => p.time >= last.time - TWO_YEARS);
  return (
    <Panel title={TITLE} sources={["nearblocks", "nearRpc"]} sqlId="total-supply">
      <LineChart series={[{ name: "Total supply", points }]} format="near" title="NEAR total supply, daily, last two years" markers={[MILESTONES.issuanceHalved]} />
    </Panel>
  );
}

/** Loading placeholder of SupplyHistoryPanel. */
export function SupplyHistoryPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}
