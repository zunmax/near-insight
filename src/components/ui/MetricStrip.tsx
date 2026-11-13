import type { ReactNode } from "react";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";

export type Metric = { label: string; value: ReactNode; detail?: string };

/** Numbers side by side in one bordered row (`.metric-strip`), each with its label and an optional line under it. */
export function MetricStrip({ metrics, className = "" }: { metrics: Metric[]; className?: string }) {
  return (
    <dl className={`metric-strip m-0 ${className}`}>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt className="text-[12px] leading-snug text-muted">
            <NoBreakTokens text={metric.label} />
          </dt>
          <dd className="m-0 mt-1 text-[18px] leading-tight font-bold whitespace-nowrap tabular-nums max-md:text-[16px]">{metric.value}</dd>
          {metric.detail ? (
            <dd className="m-0 mt-0.5 text-[11.5px] leading-snug text-faint">
              <NoBreakTokens text={metric.detail} />
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** Loading placeholder of a MetricStrip: the same `.metric-strip` grid, each cell its label's and note's length, so it
    turns into two columns on phones as the strip does. */
export function MetricStripSkeleton({ metrics, className = "" }: { metrics: Array<{ label: number; detail?: number }>; className?: string }) {
  return (
    <dl aria-hidden="true" className={`metric-strip m-0 ${className}`}>
      {metrics.map((metric, i) => (
        <div key={i}>
          <dt className="text-[12px] leading-snug">
            <SkeletonWords chars={metric.label} />
          </dt>
          <dd className="m-0 mt-1 text-[18px] leading-tight font-bold max-md:text-[16px]">
            <SkeletonWords chars={6} />
          </dd>
          {metric.detail ? (
            <dd className="m-0 mt-0.5 text-[11.5px] leading-snug">
              <SkeletonWords chars={metric.detail} />
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
