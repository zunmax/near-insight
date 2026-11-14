import type { Metadata } from "next";
import { Suspense } from "react";
import { PageMain } from "@/components/shell/PageMain";
import { AbsorptionByMonthPanel, AbsorptionByMonthPanelSkeleton } from "@/components/supply/AbsorptionByMonthPanel";
import { AbsorptionPanel, AbsorptionPanelSkeleton } from "@/components/supply/AbsorptionPanel";
import { SupplyHistoryPanel, SupplyHistoryPanelSkeleton } from "@/components/supply/SupplyHistoryPanel";
import { SupplyOutlookPanel, SupplyOutlookPanelSkeleton } from "@/components/supply/SupplyOutlookPanel";
import { TreasuryPanel, TreasuryPanelSkeleton } from "@/components/supply/TreasuryPanel";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "NEAR supply, issuance and burn",
  description: "NEAR issuance and measured supply growth, how much of it burn and buybacks offset, staking, the protocol treasury and a 5-year supply outlook.",
  alternates: { canonical: "/dashboard/supply" },
};

/** Pillar 3: new supply, how much of it usage offsets, and where total supply is heading. */
export default function SupplyPage() {
  return (
    <PageMain>
      <ThesisPageHeader id="supply" />
      <PanelBoundary title="Pillar 3">
        <Suspense fallback={<ThesisHeaderSkeleton id="supply" />}>
          <ThesisHeader id="supply" />
        </Suspense>
      </PanelBoundary>
      <PanelSlot title="Total NEAR supply" skeleton={<SupplyHistoryPanelSkeleton />}>
        <SupplyHistoryPanel />
      </PanelSlot>
      <PanelSlot title="New supply absorbed by burn and buybacks" skeleton={<AbsorptionPanelSkeleton />}>
        <AbsorptionPanel />
      </PanelSlot>
      <PanelSlot title="New supply absorbed by month" skeleton={<AbsorptionByMonthPanelSkeleton />}>
        <AbsorptionByMonthPanel />
      </PanelSlot>
      <PanelSlot title="NEAR in the protocol treasury" skeleton={<TreasuryPanelSkeleton />}>
        <TreasuryPanel />
      </PanelSlot>

      <SectionHeading title="Projection" />
      <PanelSlot title="Total NEAR supply, next 5 years" skeleton={<SupplyOutlookPanelSkeleton />}>
        <SupplyOutlookPanel />
      </PanelSlot>
    </PageMain>
  );
}
