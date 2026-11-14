import type { Metadata } from "next";
import { Suspense } from "react";
import { LatestNewsPanel, LatestNewsPanelSkeleton } from "@/components/news/LatestNewsPanel";
import { HeroPanel } from "@/components/home/HeroPanel";
import { MarketKpis, MarketKpisSkeleton } from "@/components/home/MarketKpis";
import { PricePanel, PricePanelSkeleton } from "@/components/home/PricePanel";
import { ProjectSectors } from "@/components/home/ProjectSectors";
import { ThesisTimeline } from "@/components/home/ThesisTimeline";
import { VerdictPanel, VerdictPanelSkeleton } from "@/components/home/VerdictPanel";
import { PageMain } from "@/components/shell/PageMain";
import { avatarStyle, sectionAvatarStyle } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import { PanelSlot } from "@/components/ui/PanelSlot";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourceInfo } from "@/components/ui/SourceInfo";
import { CORE_SECTIONS, SECTION_ORDER } from "@/content/thesis";

export const metadata: Metadata = {
  title: "NEAR verdict, thesis and market data",
  description: "The verdict on the latest NEAR data, NEAR Intents volume, NEAR's price and market cap, new supply absorbed, NEAR bought and the latest NEAR news.",
  alternates: { canonical: "/dashboard/home", types: { "text/markdown": "/thesis.md" } },
};

/** The three pillars and the valuation they lead to, in order in the thesis thread. */
const STEPS = SECTION_ORDER.filter((id) => CORE_SECTIONS.has(id));

/** The supporting theses, after the main steps. */
const SUPPORTING = SECTION_ORDER.filter((id) => !CORE_SECTIONS.has(id));

/** Avatars of Home's own posts, each showing its subject on the Home color: scales for the verdict, a rising line for the
    price, a light bulb for the thesis. The news post wears the News section's avatar, as on the News page. */
const AVATARS = {
  verdict: avatarStyle("M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2", 24, "var(--section-home)"),
  price: avatarStyle("M22 7l-8.5 8.5-5-5L2 17M16 7h6v6", 24, "var(--section-home)"),
  thesis: avatarStyle("M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4", 24, "var(--section-home)"),
  news: sectionAvatarStyle("news"),
};

/** Home feed: the verdict on the latest data, NEAR's market numbers and price, the thesis, then every thesis as a numbered post in one thread. */
export default function HomePage() {
  return (
    <PageMain>
      <PageHeader
        title="NEAR Protocol"
        href="/dashboard/home"
        info={
          <SourceInfo sources={["coingecko", "dune", "defillama", "nearRpc", "nearArchive", "nearblocks"]} />
        }
      >
        <ProjectSectors />
      </PageHeader>
      {/** The verdict, then the market numbers as tiles and the price chart. Phones show the numbers above the verdict as
          cards that swipe sideways, the price as their last card, in place of the chart. */}
      <div className="flex flex-col">
        <PanelSlot title="Verdict" skeleton={<VerdictPanelSkeleton />} avatar={AVATARS.verdict}>
          <VerdictPanel />
        </PanelSlot>
        <div className="max-md:order-first">
          <PanelBoundary title="NEAR market">
            <Suspense fallback={<MarketKpisSkeleton />}>
              <MarketKpis />
            </Suspense>
          </PanelBoundary>
        </div>
        <div className="max-md:hidden">
          <PanelSlot title="NEAR price" skeleton={<PricePanelSkeleton />} avatar={AVATARS.price}>
            <PricePanel />
          </PanelSlot>
        </div>
      </div>
      <div className="enter" style={AVATARS.thesis}>
        <HeroPanel />
      </div>

      <SectionHeading id="thesis" title="The thesis" />
      <div className="enter">
        <ThesisTimeline steps={STEPS} supporting={SUPPORTING} />
      </div>

      {/** Below 1100px the right column is hidden, so the latest news joins the feed there. */}
      <div className="enter min-[1100px]:hidden" style={AVATARS.news}>
        <PanelBoundary title="Latest news">
          <Suspense fallback={<LatestNewsPanelSkeleton />}>
            <LatestNewsPanel />
          </Suspense>
        </PanelBoundary>
      </div>
    </PageMain>
  );
}
