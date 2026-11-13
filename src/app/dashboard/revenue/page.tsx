import type { Metadata } from "next";
import { Suspense } from "react";
import { BuybacksPanel, BuybacksPanelSkeleton } from "@/components/revenue/BuybacksPanel";
import { BuyingOutlookPanel, BuyingOutlookPanelSkeleton } from "@/components/revenue/BuyingOutlookPanel";
import { CaptureRatePanel, CaptureRatePanelSkeleton } from "@/components/revenue/CaptureRatePanel";
import { FeeBurnPanel, FeeBurnPanelSkeleton } from "@/components/revenue/FeeBurnPanel";
import { FeeChainPanel, FeeChainPanelSkeleton } from "@/components/revenue/FeeChainPanel";
import { FeeChannelsPanel, FeeChannelsPanelSkeleton } from "@/components/revenue/FeeChannelsPanel";
import { FeeRatePanel, FeeRatePanelSkeleton } from "@/components/revenue/FeeRatePanel";
import { FeeWalletsPanel, FeeWalletsPanelSkeleton } from "@/components/revenue/FeeWalletsPanel";
import { RevenueUnitsPanel, RevenueUnitsPanelSkeleton } from "@/components/revenue/RevenueUnitsPanel";
import { PageMain } from "@/components/shell/PageMain";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";

export const metadata: Metadata = {
  title: "NEAR Intents fees, buybacks and burn",
  description: "How NEAR Intents fees buy NEAR: the share of fees that buys NEAR, fees per $1M swapped and by channel, the three fee wallets, and NEAR burned by month.",
  alternates: { canonical: "/dashboard/revenue" },
};

/** Pillar 2: what usage pays the token, as buybacks and burn. */
export default function RevenuePage() {
  return (
    <PageMain>
      <ThesisPageHeader id="capture" />
      <PanelBoundary title="Pillar 2">
        <Suspense fallback={<ThesisHeaderSkeleton id="capture" />}>
          <ThesisHeader id="capture" />
        </Suspense>
      </PanelBoundary>
      <PanelSlot title="NEAR bought by month" skeleton={<BuybacksPanelSkeleton />}>
        <BuybacksPanel />
      </PanelSlot>
      <PanelSlot title="Share of fees that buys NEAR, by month" skeleton={<CaptureRatePanelSkeleton />}>
        <CaptureRatePanel />
      </PanelSlot>
      <PanelSlot title="From NEAR Intents volume to NEAR bought" skeleton={<FeeChainPanelSkeleton />}>
        <FeeChainPanel />
      </PanelSlot>
      <PanelSlot title="NEAR burned by month" skeleton={<FeeBurnPanelSkeleton />}>
        <FeeBurnPanel />
      </PanelSlot>
      <PanelSlot title="How much NEAR the fees could buy" skeleton={<BuyingOutlookPanelSkeleton />}>
        <BuyingOutlookPanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents fees per $1M swapped, by month" skeleton={<FeeRatePanelSkeleton />}>
        <FeeRatePanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents fees by channel" skeleton={<FeeChannelsPanelSkeleton />}>
        <FeeChannelsPanel />
      </PanelSlot>
      <PanelSlot title="NEAR in the three fee wallets" skeleton={<FeeWalletsPanelSkeleton />}>
        <FeeWalletsPanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents revenue in dollars and in NEAR" skeleton={<RevenueUnitsPanelSkeleton />}>
        <RevenueUnitsPanel />
      </PanelSlot>
    </PageMain>
  );
}
