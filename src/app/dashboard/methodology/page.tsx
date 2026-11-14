import type { Metadata } from "next";
import { Suspense } from "react";
import { DataChecksPanel, DataChecksPanelSkeleton } from "@/components/methodology/DataChecksPanel";
import { DataSourcesPanel } from "@/components/methodology/DataSourcesPanel";
import { ExportPanel } from "@/components/methodology/ExportPanel";
import { FreshnessPanel, FreshnessPanelSkeleton } from "@/components/methodology/FreshnessPanel";
import { MethodNotesPanel } from "@/components/methodology/MethodNotesPanel";
import { RerunPanel } from "@/components/methodology/RerunPanel";
import { PageMain } from "@/components/shell/PageMain";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";

export const metadata: Metadata = {
  title: "Methodology and data sources",
  description: "Where every number on NEAR Insights comes from, how each is calculated, how fresh it is and how to rebuild the data yourself.",
  alternates: { canonical: "/dashboard/methodology" },
};

/** Data sources, definitions, cross-source checks, freshness, downloads and how to re-run everything. */
export default function MethodologyPage() {
  return (
    <PageMain>
      <PageHeader title="Methodology" href="/dashboard/methodology" />
      <div className="enter">
        <DataSourcesPanel />
      </div>
      <div className="enter">
        <MethodNotesPanel />
      </div>
      <div className="enter">
        <PanelBoundary title="Data checks">
          <Suspense fallback={<DataChecksPanelSkeleton />}>
            <DataChecksPanel />
          </Suspense>
        </PanelBoundary>
      </div>
      <div className="enter">
        <PanelBoundary title="Data freshness">
          <Suspense fallback={<FreshnessPanelSkeleton />}>
            <FreshnessPanel />
          </Suspense>
        </PanelBoundary>
      </div>
      <div className="enter">
        <ExportPanel />
      </div>
      <div className="enter">
        <RerunPanel />
      </div>
    </PageMain>
  );
}
