import { io } from "next/cache";
import { BuyingOutlook, BuyingOutlookSkeleton } from "@/components/revenue/BuyingOutlook";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";

const TITLE = "How much NEAR the fees could buy";

/** Seeds the fee-chain projection with live volume, fee rate and share of fees that buys NEAR. */
export async function BuyingOutlookPanel() {
  await io();
  const { seed, feeChain } = await getThesisMetrics();
  if (!seed || !feeChain || seed.feeRate === null || seed.captureRate === null) return <NoData title={TITLE} />;

  return (
    <Panel
      title={TITLE}
      sources={["dune", "defillama", "coingecko", "nearRpc", "nearArchive"]}
      sqlId="projection-inputs"
      viewLabel="Model"
    >
      {/** Keyed by the data, so a page kept alive and shown again starts from the current rates, not the ones it first read. */}
      <BuyingOutlook
        key={`${seed.through}|${seed.feeRate}|${seed.captureRate}|${feeChain.through}`}
        seed={seed}
        rates={{ feeRate: seed.feeRate, captureRate: seed.captureRate, feesThrough: feeChain.through }}
      />
    </Panel>
  );
}

/** Loading placeholder of BuyingOutlookPanel. */
export function BuyingOutlookPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Model">
      <BuyingOutlookSkeleton />
    </PanelSkeleton>
  );
}
