import type { ReactNode } from "react";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";

const SUMMARY = "How this is calculated";

/** A panel's notes on how its numbers are calculated, folded behind one "How this is calculated" line. */
export function HowCalculated({ children }: { children: ReactNode }) {
  return (
    <details className="how-calculated mt-3">
      <summary>{SUMMARY}</summary>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{children}</p>
    </details>
  );
}

/** Loading placeholder of the folded HowCalculated line: its round "+" and its words. */
export function HowCalculatedSkeleton() {
  return (
    <p aria-hidden="true" className="mt-3 flex h-6 items-center gap-1.5 text-[12px]">
      <span className="skeleton size-4 rounded-full" />
      <SkeletonWords chars={SUMMARY.length} />
    </p>
  );
}
