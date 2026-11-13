import type { Metadata } from "next";
import { Suspense } from "react";
import { PeersTable, PeersTableSkeleton } from "@/components/peers/PeersTable";
import { SupplyGrowthPeersPanel, SupplyGrowthPeersPanelSkeleton } from "@/components/peers/SupplyGrowthPeersPanel";
import { PageMain } from "@/components/shell/PageMain";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";

export const metadata: Metadata = {
  title: "NEAR supply against larger coins",
  description: "NEAR's supply against the coins ranked above it: circulating supply growth over 12 months and supply still to unlock.",
  alternates: { canonical: "/dashboard/peers" },
};

/** Supply comparisons between NEAR and every coin ranked above it. */
export default function PeersPage() {
  return (
    <PageMain>
      <ThesisPageHeader id="peers" />
      <PanelBoundary title="Peers">
        <Suspense fallback={<ThesisHeaderSkeleton id="peers" />}>
          <ThesisHeader id="peers" />
        </Suspense>
      </PanelBoundary>
      <PanelSlot title="Circulating supply growth, 12 months" skeleton={<SupplyGrowthPeersPanelSkeleton />}>
        <SupplyGrowthPeersPanel />
      </PanelSlot>
      <PanelSlot title="The coins ranked above NEAR" skeleton={<PeersTableSkeleton />}>
        <PeersTable />
      </PanelSlot>
    </PageMain>
  );
}
