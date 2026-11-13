import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsResults, NewsResultsSkeleton } from "@/components/news/NewsResults";
import { PageMain } from "@/components/shell/PageMain";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";

export const metadata: Metadata = {
  title: "NEAR news",
  description: "Every story about NEAR in one searchable list, newest first, from crypto news sites.",
};

export default function NewsPage({ searchParams }: PageProps<"/dashboard/news">) {
  return (
    <PageMain>
      <PageHeader title="NEAR news" href="/dashboard/news" />
      <div className="flex flex-1 flex-col">
        <PanelBoundary title="Latest NEAR news">
          <Suspense fallback={<NewsResultsSkeleton />}>
            <NewsResults searchParams={searchParams} />
          </Suspense>
        </PanelBoundary>
      </div>
    </PageMain>
  );
}
