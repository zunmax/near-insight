import type { Metadata } from "next";
import { Suspense } from "react";
import { DevelopersPanel, DevelopersPanelSkeleton } from "@/components/network/DevelopersPanel";
import { StakeDistributionPanel, StakeDistributionPanelSkeleton } from "@/components/network/StakeDistributionPanel";
import { ValidatorTiles, ValidatorTilesSkeleton } from "@/components/network/ValidatorTiles";
import { PageMain } from "@/components/shell/PageMain";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";

export const metadata: Metadata = {
  title: "NEAR validators, stake and developers",
  description: "NEAR validators, the cost of a validator seat, stake distribution and monthly active developers.",
  alternates: { canonical: "/dashboard/network" },
};

/** Supporting thesis: who secures NEAR and who builds on it. */
export default function NetworkPage() {
  return (
    <PageMain>
      <ThesisPageHeader id="network" />
      <PanelBoundary title="Network">
        <Suspense fallback={<ThesisHeaderSkeleton id="network" />}>
          <ThesisHeader id="network" />
        </Suspense>
      </PanelBoundary>
      <div className="enter tile-grid">
        <PanelBoundary title="Validators">
          <Suspense fallback={<ValidatorTilesSkeleton />}>
            <ValidatorTiles />
          </Suspense>
        </PanelBoundary>
      </div>
      <PanelSlot title="Monthly active developers" skeleton={<DevelopersPanelSkeleton />}>
        <DevelopersPanel />
      </PanelSlot>
      <PanelSlot title="Stake by validator" skeleton={<StakeDistributionPanelSkeleton />}>
        <StakeDistributionPanel />
      </PanelSlot>
    </PageMain>
  );
}
