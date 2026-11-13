import type { Metadata } from "next";
import { Suspense } from "react";
import { CoverageModelPanel, CoverageModelPanelSkeleton } from "@/components/valuation/CoverageModelPanel";
import { CoverageScenariosPanel, CoverageScenariosPanelSkeleton } from "@/components/valuation/CoverageScenariosPanel";
import { RevenueMultiplePanel, RevenueMultiplePanelSkeleton } from "@/components/valuation/RevenueMultiplePanel";
import { ValuationAnchorPanel, ValuationAnchorPanelSkeleton } from "@/components/valuation/ValuationAnchorPanel";
import { PageMain } from "@/components/shell/PageMain";
import { ThesisHeader, ThesisHeaderSkeleton } from "@/components/thesis/ThesisHeader";
import { ThesisPageHeader } from "@/components/thesis/ThesisPageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "NEAR valuation: what the price assumes",
  description: "What NEAR's price assumes about buyback growth, market cap against network revenue over time, projection scenarios, and a model to test your own.",
  alternates: { canonical: "/dashboard/valuation" },
};

/** The valuation thesis, what the price assumes, market cap ÷ network revenue over time, the projected coverage of
    issuance in up to three scenarios, and the model behind it. */
export default function ValuationPage() {
  return (
    <PageMain>
      <ThesisPageHeader id="valuation" />
      <PanelBoundary title="Valuation">
        <Suspense fallback={<ThesisHeaderSkeleton id="valuation" />}>
          <ThesisHeader id="valuation" />
        </Suspense>
      </PanelBoundary>
      <PanelSlot title="What the price assumes" skeleton={<ValuationAnchorPanelSkeleton />}>
        <ValuationAnchorPanel />
      </PanelSlot>
      <PanelSlot title="NEAR market cap ÷ network revenue" skeleton={<RevenueMultiplePanelSkeleton />}>
        <RevenueMultiplePanel />
      </PanelSlot>

      <SectionHeading title="Projections" />
      <PanelSlot title="Projections" skeleton={<CoverageScenariosPanelSkeleton />}>
        <CoverageScenariosPanel />
      </PanelSlot>

      <SectionHeading title="Model" />
      <PanelSlot title="Coverage model: burn + buybacks ÷ issuance" skeleton={<CoverageModelPanelSkeleton />}>
        <CoverageModelPanel />
      </PanelSlot>
    </PageMain>
  );
}
