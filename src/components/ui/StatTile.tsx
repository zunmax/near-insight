import { Icon, type IconName } from "@/components/ui/Icon";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { SourceInfo } from "@/components/ui/SourceInfo";
import type { SourceRef } from "@/config/sources";

type StatTileProps = {
  label: string;
  value: string;
  /** Icon before the label. */
  icon: IconName;
  detail?: string;
  sources: SourceRef[];
  /** The line under the sources, e.g. "Epoch 4958". */
  through?: string;
};

/** A stat tile: the icon and label, a large value and a short detail. */
export function StatTile({ label, value, icon, detail, sources, through }: StatTileProps) {
  return (
    <div className="panel tile h-full">
      <div className="panel-head justify-start gap-2">
        <Icon name={icon} strokeWidth={1.5} className="size-[15px] shrink-0 text-accent" />
        <p className="panel-title flex-1">
          <NoBreakTokens text={label} />
        </p>
        <SourceInfo sources={sources} through={through} />
      </div>
      <div className="panel-body flex flex-col">
        <p className="text-[22px] leading-none font-extrabold tracking-[-0.01em] text-ink tabular-nums">{value}</p>
        {detail ? (
          <p className="mt-2.5 text-[13px] leading-snug text-muted">
            <NoBreakTokens text={detail} />
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Loading placeholder of a StatTile: the label's length (`label`), the value, and the detail's length (`detail`). */
export function StatTileSkeleton({ label, detail }: { label: number; detail?: number }) {
  return (
    <div aria-hidden="true" className="panel tile h-full">
      <div className="panel-head justify-start gap-2">
        <span className="skeleton size-[15px] shrink-0" />
        <p className="panel-title flex-1">
          <SkeletonWords chars={label} />
        </p>
        <span className="size-4 shrink-0" />
      </div>
      <div className="panel-body flex flex-col">
        <p className="text-[22px] leading-none font-extrabold">
          <SkeletonWords chars={6} />
        </p>
        {detail ? (
          <p className="mt-2.5 text-[13px] leading-snug">
            <SkeletonWords chars={detail} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
