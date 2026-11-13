import { io } from "next/cache";
import { CoverageModel, CoverageModelSkeleton } from "@/components/valuation/CoverageModel";
import { describeProposalStatus, proposalFailed } from "@/lib/thesis/proposal-status";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";

const TITLE = "Coverage model: burn + buybacks ÷ issuance";

/** Seeds the calculator with live values from the database. */
export async function CoverageModelPanel() {
  await io();
  const { seed, hsp029 } = await getThesisMetrics();
  if (!seed) return <NoData title={TITLE} />;

  return (
    <Panel
      title={TITLE}
      sources={["coingecko", "nearRpc", "nearArchive", "dune", "defillama"]}
      sqlId="projection-inputs"
      viewLabel="Model"
    >
      <CoverageModel seed={seed} hsp029Status={hsp029 ? describeProposalStatus(hsp029) : null} hsp029Failed={hsp029 !== null && proposalFailed(hsp029)} />
    </Panel>
  );
}

/** Loading placeholder of CoverageModelPanel. */
export function CoverageModelPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Model">
      <CoverageModelSkeleton />
    </PanelSkeleton>
  );
}
