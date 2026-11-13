import { Suspense, type CSSProperties, type ReactNode } from "react";
import { PanelBoundary } from "@/components/ui/PanelBoundary";

type PanelSlotProps = {
  /** Panel title, shown when the panel fails to load. */
  title: string;
  /** The panel's loading placeholder, laid out as the panel (a PanelSkeleton exported beside it). */
  skeleton: ReactNode;
  /** Avatar of this post (avatarStyle) in place of the page's, kept by the skeleton, the panel and its error alike. */
  avatar?: CSSProperties;
  children: ReactNode;
};

/** One post of a page feed: a panel that streams in behind its skeleton, plays the entrance animation, and fails on its own. */
export function PanelSlot({ title, skeleton, avatar, children }: PanelSlotProps) {
  return (
    <div className="enter" style={avatar}>
      <PanelBoundary title={title}>
        <Suspense fallback={skeleton}>{children}</Suspense>
      </PanelBoundary>
    </div>
  );
}
