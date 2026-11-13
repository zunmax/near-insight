import { Suspense } from "react";
import { LatestNewsPanel, LatestNewsPanelSkeleton } from "@/components/news/LatestNewsPanel";
import { AtAGlance, AtAGlanceSkeleton } from "@/components/shell/AtAGlance";
import { StickyAside } from "@/components/shell/StickyAside";
import { Icon } from "@/components/ui/Icon";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { NEWS_QUERY_MAX_LENGTH } from "@/lib/news";

/** Right column on wide screens: the news search, NEAR's key numbers and the latest news. */
export function FeedAside() {
  return (
    <StickyAside label="At a glance and latest news">
      <form action="/dashboard/news" role="search" className="pt-1">
        <label htmlFor="aside-search" className="sr-only">
          Search NEAR news
        </label>
        <div className="flex h-11 items-center gap-3 rounded-[8px] border border-transparent bg-surface-3 px-4 text-muted transition-colors focus-within:border-accent focus-within:bg-bg focus-within:text-accent">
          <Icon name="search" strokeWidth={1.6} className="size-[18px] shrink-0" />
          <input
            id="aside-search"
            name="q"
            type="search"
            maxLength={NEWS_QUERY_MAX_LENGTH}
            placeholder="Search NEAR news"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>
      </form>
      <PanelBoundary title="At a glance">
        <Suspense fallback={<AtAGlanceSkeleton />}>
          <AtAGlance />
        </Suspense>
      </PanelBoundary>
      <PanelBoundary title="Latest news">
        <Suspense fallback={<LatestNewsPanelSkeleton />}>
          <LatestNewsPanel />
        </Suspense>
      </PanelBoundary>
    </StickyAside>
  );
}
