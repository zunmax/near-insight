import { Suspense } from "react";
import { ThesisCard, ThesisCardSkeleton } from "@/components/home/ThesisCard";
import { PanelBoundary } from "@/components/ui/PanelBoundary";
import type { SectionId } from "@/content/thesis";

/** Every thesis as a numbered post in one thread: the main steps first, then the supporting theses. */
export function ThesisTimeline({ steps, supporting }: { steps: SectionId[]; supporting: SectionId[] }) {
  const all = [...steps, ...supporting];
  return (
    <div className="thread">
      {all.map((id, i) => (
        <PanelBoundary key={id} title="Thesis">
          <Suspense fallback={<ThesisCardSkeleton id={id} number={i + 1} total={all.length} />}>
            <ThesisCard id={id} number={i + 1} total={all.length} />
          </Suspense>
        </PanelBoundary>
      ))}
    </div>
  );
}
