import type { Metadata } from "next";
import { Suspense } from "react";
import { MoreNews, MoreNewsSkeleton } from "@/components/news/MoreNews";
import { NewsStory, NewsStorySkeleton } from "@/components/news/NewsStory";
import { PageMain } from "@/components/shell/PageMain";
import { PanelBoundary } from "@/components/ui/PanelBoundary";

export const metadata: Metadata = { title: "News story", description: "A NEAR news story: summary, publisher and a link to the full article." };

/** One story, chosen by `?id=`; a query string keeps the path static so the layout prerenders. */
export default function NewsStoryPage({ searchParams }: PageProps<"/dashboard/news/story">) {
  return (
    <PageMain>
      <PanelBoundary title="Story">
        <Suspense fallback={<NewsStorySkeleton />}>
          <NewsStory searchParams={searchParams} />
        </Suspense>
      </PanelBoundary>
      <PanelBoundary title="More NEAR news">
        <Suspense fallback={<MoreNewsSkeleton />}>
          <MoreNews searchParams={searchParams} />
        </Suspense>
      </PanelBoundary>
    </PageMain>
  );
}
