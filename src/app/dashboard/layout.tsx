import type { ReactNode } from "react";
import { NewsEventsProvider } from "@/components/news/NewsEventsProvider";
import { FeedAside } from "@/components/shell/FeedAside";
import { MobileHeader } from "@/components/shell/MobileHeader";
import { SectionSwipe } from "@/components/shell/SectionSwipe";
import { Sidebar } from "@/components/shell/Sidebar";
import { NEWS_EVENTS } from "@/config/news-events";

/** Dashboard shell: the left navigation, the feed column, the right column, and on phones the header with the section tabs
    and a sideways swipe between sections. One news WebSocket serves every news feed and live badge on the page. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <NewsEventsProvider url={NEWS_EVENTS.publicUrl}>
      {/** Hidden until a keyboard reaches it, so the navigation can be skipped on every page. */}
      <a href="#content" className="btn btn-primary skip-link">
        Skip to content
      </a>
      <div className="x-shell">
        <Sidebar />
        <div className="x-center">
          <MobileHeader />
          <SectionSwipe>{children}</SectionSwipe>
        </div>
        <FeedAside />
      </div>
    </NewsEventsProvider>
  );
}
