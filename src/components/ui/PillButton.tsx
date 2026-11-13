import type { ReactNode } from "react";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";

/** A pill that picks one option of a group: outlined, and filled in ink while pressed. */
export function PillButton({ pressed, onClick, className = "", children }: { pressed: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`btn btn-sm btn-secondary aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg ${className}`}
    >
      {children}
    </button>
  );
}

/** Loading placeholder of a row of PillButtons, each its label's length: it wraps on wider screens and is clipped at the
    right on phones, as the scenario and model input rows are. */
export function PillRowSkeleton({ labels }: { labels: number[] }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-hidden max-sm:[mask-image:linear-gradient(to_left,transparent,#000_24px)]">
      {labels.map((chars, i) => (
        <span key={i} className="btn btn-sm btn-secondary shrink-0 text-[12.5px]">
          <SkeletonWords chars={chars} />
        </span>
      ))}
    </div>
  );
}
