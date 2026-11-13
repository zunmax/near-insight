import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveActivitySkeleton } from "@/components/technology/LiveActivity";
import { LiveActivitySection } from "@/components/technology/LiveActivitySection";
import { PageMain } from "@/components/shell/PageMain";
import { ProtocolPanel, ProtocolPanelSkeleton } from "@/components/technology/ProtocolPanel";
import { TechTiles, TechTilesSkeleton } from "@/components/technology/TechTiles";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { FactTable } from "@/components/ui/FactTable";
import { Panel } from "@/components/ui/Panel";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";
import { TECHNOLOGY_FACTS } from "@/content/facts";

export const metadata: Metadata = {
  title: "NEAR technology: shards, finality and upgrades",
  description: "NEAR shards, transfer cost, finality and block time, live mainnet activity, protocol upgrades and nearcore releases.",
  alternates: { canonical: "/dashboard/technology" },
};

/** Supporting thesis: the chain can carry the usage. */
export default function TechnologyPage() {
  return (
    <PageMain>
      <ThesisPageHeader id="technology" />
      <PanelBoundary title="Technology">
        <Suspense fallback={<ThesisHeaderSkeleton id="technology" />}>
          <ThesisHeader id="technology" />
        </Suspense>
      </PanelBoundary>
      <div className="enter tile-grid">
        <PanelBoundary title="Technology">
          <Suspense fallback={<TechTilesSkeleton />}>
            <TechTiles />
          </Suspense>
        </PanelBoundary>
      </div>
      <PanelSlot title="Live on NEAR mainnet" skeleton={<LiveActivitySkeleton />}>
        <LiveActivitySection />
      </PanelSlot>
      <PanelSlot title="Protocol upgrades" skeleton={<ProtocolPanelSkeleton />}>
        <ProtocolPanel />
      </PanelSlot>
      <div className="enter">
        <Panel title="Scaling and security facts">
          <FactTable facts={TECHNOLOGY_FACTS} caption="NEAR scaling and security facts" />
        </Panel>
      </div>
    </PageMain>
  );
}
