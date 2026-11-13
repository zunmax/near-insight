import { io } from "next/cache";
import { BarList, BarListSkeleton } from "@/components/charts/BarList";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getLatestValidators } from "@/data/network";
import { formatCount, formatPercent } from "@/lib/format";

const TITLE = "Stake by validator";
/** Number of largest validators listed. */
const SHOWN_VALIDATORS = 15;

/** Share of total stake held by the largest validators. */
export async function StakeDistributionPanel() {
  await io();
  const set = await getLatestValidators();
  if (!set) return <NoData title={TITLE} />;
  const total = set.validators.reduce((sum, v) => sum + v.stakeNear, 0);
  const top = set.validators.slice(0, SHOWN_VALIDATORS);
  const topShare = top.reduce((sum, v) => sum + v.stakeNear, 0) / total;
  const rows = top.map((v) => ({
    label: v.accountId.replace(/\.(pool|poolv1)\.near$/, ""),
    value: v.stakeNear / total,
    display: formatPercent(v.stakeNear / total, 1),
  }));
  return (
    <Panel
      title={TITLE}
      description={`The ${top.length} largest of ${formatCount(set.validators.length, "validator")} hold ${formatPercent(topShare, 0)} of stake.`}
      sources={["nearRpc"]}
      sqlId="validator-stake"
    >
      <BarList rows={rows} caption={`Share of total stake held by the ${SHOWN_VALIDATORS} largest NEAR validators`} />
    </Panel>
  );
}

/** Loading placeholder of StakeDistributionPanel. */
export function StakeDistributionPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={51} tabs="Chart">
      <BarListSkeleton rows={SHOWN_VALIDATORS} />
    </PanelSkeleton>
  );
}
