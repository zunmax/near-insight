import type { Metadata } from "next";
import { Suspense } from "react";
import { PageMain } from "@/components/shell/PageMain";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  AccountsPanel,
  AccountsPanelSkeleton,
  StablecoinsPanel,
  StablecoinsPanelSkeleton,
  TransactionsPanel,
  TransactionsPanelSkeleton,
  TvlPanel,
  TvlPanelSkeleton,
} from "@/components/usage/ActivityPanels";
import { IntentsConfidentialPanel, IntentsConfidentialPanelSkeleton } from "@/components/usage/IntentsConfidentialPanel";
import { IntentsChainMixPanel, IntentsChainMixPanelSkeleton, IntentsStablecoinPanel, IntentsStablecoinPanelSkeleton } from "@/components/usage/IntentsFlowPanels";
import { DexSharePanel, DexSharePanelSkeleton, IntentsTxnSharePanel, IntentsTxnSharePanelSkeleton } from "@/components/usage/IntentsSharePanels";
import { IntentsSwapsPanel, IntentsSwapsPanelSkeleton } from "@/components/usage/IntentsSwapsPanel";
import { IntentsTvlPanel, IntentsTvlPanelSkeleton } from "@/components/usage/IntentsTvlPanel";
import { IntentsVolumePanel, IntentsVolumePanelSkeleton } from "@/components/usage/IntentsVolumePanel";
import { LeadLagPanel, LeadLagPanelSkeleton } from "@/components/usage/LeadLagPanel";
import { VolumeOutlookPanel, VolumeOutlookPanelSkeleton } from "@/components/usage/VolumeOutlookPanel";

export const metadata: Metadata = {
  title: "NEAR Intents volume and NEAR usage",
  description: "NEAR Intents volume, swaps, confidential share and funds held, its share of NEAR transactions and DEX volume, and activity on NEAR vs a year earlier.",
  alternates: { canonical: "/dashboard/usage" },
};

/** Pillar 1: NEAR Intents volume, the chains it is counted under, its swaps, share of transactions, confidential share, funds
    held, DEX share, stablecoins, the lead-lag tests and a volume projection, then activity on the chain. */
export default function UsagePage() {
  return (
    <PageMain>
      <ThesisPageHeader id="demand" />
      <PanelBoundary title="Pillar 1">
        <Suspense fallback={<ThesisHeaderSkeleton id="demand" />}>
          <ThesisHeader id="demand" />
        </Suspense>
      </PanelBoundary>
      <PanelSlot title="NEAR Intents volume, 30-day totals" skeleton={<IntentsVolumePanelSkeleton />}>
        <IntentsVolumePanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents volume by chain" skeleton={<IntentsChainMixPanelSkeleton />}>
        <IntentsChainMixPanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents swaps per day" skeleton={<IntentsSwapsPanelSkeleton />}>
        <IntentsSwapsPanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents share of NEAR transactions" skeleton={<IntentsTxnSharePanelSkeleton />}>
        <IntentsTxnSharePanel />
      </PanelSlot>
      <PanelSlot title="Confidential share of NEAR Intents volume" skeleton={<IntentsConfidentialPanelSkeleton />}>
        <IntentsConfidentialPanel />
      </PanelSlot>
      <PanelSlot title="Funds held in NEAR Intents" skeleton={<IntentsTvlPanelSkeleton />}>
        <IntentsTvlPanel />
      </PanelSlot>
      <PanelSlot title="NEAR Intents share of DEX volume on NEAR" skeleton={<DexSharePanelSkeleton />}>
        <DexSharePanel />
      </PanelSlot>
      <PanelSlot title="Stablecoin share of NEAR Intents volume" skeleton={<IntentsStablecoinPanelSkeleton />}>
        <IntentsStablecoinPanel />
      </PanelSlot>
      <PanelSlot title="Lead-lag tests: NEAR Intents volume, NEAR's price and active accounts" skeleton={<LeadLagPanelSkeleton />}>
        <LeadLagPanel />
      </PanelSlot>
      <PanelSlot title="Projected NEAR Intents volume" skeleton={<VolumeOutlookPanelSkeleton />}>
        <VolumeOutlookPanel />
      </PanelSlot>

      <SectionHeading title="Activity on NEAR" />
      <PanelSlot title="Transactions per day" skeleton={<TransactionsPanelSkeleton />}>
        <TransactionsPanel />
      </PanelSlot>
      <PanelSlot title="DeFi TVL on NEAR" skeleton={<TvlPanelSkeleton />}>
        <TvlPanel />
      </PanelSlot>
      <PanelSlot title="Active and new accounts per day" skeleton={<AccountsPanelSkeleton />}>
        <AccountsPanel />
      </PanelSlot>
      <PanelSlot title="Stablecoins on NEAR" skeleton={<StablecoinsPanelSkeleton />}>
        <StablecoinsPanel />
      </PanelSlot>
    </PageMain>
  );
}
