import type { Metadata } from "next";
import { QueryCatalog } from "@/components/queries/QueryCatalog";
import { PageMain } from "@/components/shell/PageMain";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "SQL behind every chart",
  description: "The SQL behind every chart on NEAR Insights, the public requests that filled its tables, and how to run each query yourself.",
  alternates: { canonical: "/dashboard/queries" },
};

/** The query catalog: every chart's SQL with its API link, CSV download and command line. */
export default function QueriesPage() {
  return (
    <PageMain>
      <PageHeader title="Queries" href="/dashboard/queries" />
      <div className="enter">
        <QueryCatalog />
      </div>
    </PageMain>
  );
}
