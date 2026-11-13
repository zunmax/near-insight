import type { CSSProperties } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { Icon, type IconName } from "@/components/ui/Icon";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { formatChange, percentRounded } from "@/lib/format";

type KpiCardProps = {
  label: string;
  value: string;
  /** Window shown at the right of the title row, e.g. "30D". */
  period?: string;
  /** Icon before the label. */
  icon?: IconName;
  /** Change shown in green (rise) or red (fall), with what it compares against in a few words, e.g. "vs a year earlier". */
  change?: { value: number; against: string } | null;
  /** Line under the value when there is no change to show. */
  detail?: string;
  /** Values for the small chart beside the value. */
  trend?: number[];
  /** A card in the phones' swipe row, most of the screen wide: below 768px a larger number and a taller chart, and the
      change under the value rather than beside it; from 768px a card like the others. */
  large?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** A signed change in green for a rise or red for a fall; one that rounds to 0.0% is neither. */
export function ChangePill({ value, className = "" }: { value: number; className?: string }) {
  const shown = percentRounded(value, 1);
  return <span className={`delta ${shown > 0 ? "delta-up" : shown < 0 ? "delta-down" : ""} ${className}`}>{formatChange(value)}</span>;
}

/** The value row: the number, then the small chart, which shrinks to make room so the number never wraps; a card without
    a chart gives the number the whole row. */
const bodyClass = (chart: boolean) => `panel-body m-0 grid items-end gap-x-3 ${chart ? "grid-cols-[auto_minmax(40px,1fr)]" : "grid-cols-1"}`;
/** The line under the value, kept to one line: the comparison or the detail. */
const LINE_CLASS = "col-span-full mt-2.5 flex items-baseline gap-1.5 text-[13px] leading-snug whitespace-nowrap text-muted";
const chartClass = (large: boolean) =>
  `w-full min-w-[40px] justify-self-end h-[40px] max-w-[120px] ${large ? "max-md:h-[52px] max-md:max-w-[140px]" : ""}`;
const valueClass = (large: boolean) => `leading-none font-extrabold tracking-[-0.01em] whitespace-nowrap text-[22px] ${large ? "max-md:text-[28px]" : ""}`;

/** A KPI card: the icon, label and window in the title row; the value with its change and a small chart; then what the
    change compares against, or a detail line. The title row and the value are a <dt> and <dd>, the card their group, so
    cards sit inside a <dl>. */
export function KpiCard({ label, value, period, icon, change, detail, trend, large = false, className = "", style }: KpiCardProps) {
  const chart = trend !== undefined && trend.length > 1;
  return (
    <div className={`panel tile ${className}`} style={style}>
      <dt className="panel-head justify-start gap-2">
        {icon ? <Icon name={icon} strokeWidth={1.5} className="size-[15px] shrink-0 text-accent" /> : null}
        <span className="panel-title flex-1 leading-snug">
          <NoBreakTokens text={label} />
        </span>
        {period ? <span className="shrink-0 text-[12px] font-medium text-faint">{period}</span> : null}
      </dt>
      <dd className={bodyClass(chart)}>
        <span className="flex items-baseline gap-2">
          <span className={`${valueClass(large)} text-ink tabular-nums`}>{value}</span>
          {change ? <ChangePill value={change.value} className={large ? "max-md:hidden" : ""} /> : null}
        </span>
        {chart ? <Sparkline values={trend} className={`draw-x ${chartClass(large)}`} /> : null}
        {change ? (
          <span className={LINE_CLASS}>
            {large ? <ChangePill value={change.value} className="md:hidden" /> : null}
            {change.against}
          </span>
        ) : detail ? (
          <span className={LINE_CLASS}>{detail}</span>
        ) : null}
      </dd>
    </div>
  );
}

type KpiCardSkeletonProps = {
  /** Length of the label. */
  label: number;
  /** The card shows a window at the right of the title row. */
  period?: boolean;
  /** Length of the change, shown beside the value (under it on `large` cards). */
  change?: number;
  /** Length of the comparison or detail line under the value. */
  detail?: number;
  /** The card has a small chart. */
  trend?: boolean;
  large?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Loading placeholder of a KpiCard with the same parts, sizes and classes, so it sits in a `<dl>` grid or swipe row as the card does. */
export function KpiCardSkeleton({ label, period = false, change, detail, trend = false, large = false, className = "", style }: KpiCardSkeletonProps) {
  return (
    <div aria-hidden="true" className={`panel tile ${className}`} style={style}>
      <dt className="panel-head justify-start gap-2">
        <span className="skeleton size-[15px] shrink-0" />
        <span className="panel-title flex-1 leading-snug">
          <SkeletonWords chars={label} />
        </span>
        {period ? <span className="skeleton h-3.5 w-8 shrink-0" /> : null}
      </dt>
      <dd className={bodyClass(trend)}>
        <span className="flex items-baseline gap-2">
          <span className={valueClass(large)}>
            <SkeletonWords chars={6} />
          </span>
          {change ? (
            <span className={`text-[13px] ${large ? "max-md:hidden" : ""}`}>
              <SkeletonWords chars={change} />
            </span>
          ) : null}
        </span>
        {trend ? <span className={`skeleton ${chartClass(large)}`} /> : null}
        {detail ? (
          <span className={LINE_CLASS}>
            {large && change ? (
              <span className="md:hidden">
                <SkeletonWords chars={change} />
              </span>
            ) : null}
            <SkeletonWords chars={detail} />
          </span>
        ) : null}
      </dd>
    </div>
  );
}
