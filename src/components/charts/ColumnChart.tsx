"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { AXIS_UNIT_MIN_WIDTH, axisDigits, formatAxisValue, formatValue, labelWidthPx, niceTicks, type ValueFormat } from "@/components/charts/chart-format";

type ColumnPoint = { label: string; value: number };

const PLOT_HEIGHT = 220;
/** Room above the tallest bar for the value pill. */
const TOP_PAD = 26;

type ColumnChartProps = {
  points: ColumnPoint[];
  title: string;
  format?: ValueFormat;
  /** Words before a column's label in its value pill, e.g. "30 days to" for rolling windows; none for calendar months. */
  periodPrefix?: string;
  /** Column selected before the pointer picks one, e.g. the newest complete month; the newest column when left out. */
  selected?: number;
  /** Columns that cover only part of their period, drawn lighter. */
  partial?: number[];
};

/** Widest a column gets; a wider band leaves the rest as space between columns. */
const MAX_BAR_PX = 24;
/** Share of a band a column fills when the band is too narrow for MAX_BAR_PX. */
const BAR_SHARE = 0.62;
/** Opacity of a column that covers only part of its period. */
const PARTIAL_OPACITY = 0.42;
/** Space kept between two column labels. */
const LABEL_GAP_PX = 10;
/** Space between the plot and the y axis labels on its right. */
const AXIS_GAP_PX = 12;
/** Space between a column and its value pill. */
const PILL_GAP_PX = 6;

/** Column chart: green columns, rounded at the end away from zero, that grow in on load; the active one is a step stronger,
    with a guide from its end to the axis on the right and its value in a tooltip pill. The column under the pointer is
    active, otherwise the `selected` one (the newest by default). */
export function ColumnChart({ points, title, format = "usd", periodPrefix = "", selected, partial = [] }: ColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = chart.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** The scale always includes zero, so columns grow up from it and a negative value grows down from it. */
  const { low, top, ticks } = useMemo(() => {
    const values = points.map((p) => p.value);
    /** Only an all-zero chart gets a positive range to draw in; all-negative columns keep zero as the top. */
    const t = niceTicks(Math.min(0, ...values), values.every((v) => v === 0) ? 1 : Math.max(0, ...values));
    return { low: t[0] ?? 0, top: t.at(-1) ?? 1, ticks: t };
  }, [points]);
  const yOf = (value: number) => TOP_PAD + ((PLOT_HEIGHT - TOP_PAD) * (top - value)) / (top - low || 1);
  const active = hover ?? selected ?? points.length - 1;
  const digits = axisDigits(ticks, format);
  const tickLabel = (tick: number) => formatAxisValue(tick, format, digits, width >= AXIS_UNIT_MIN_WIDTH);
  const axisWidth = Math.max(...ticks.map((tick) => labelWidthPx(tickLabel(tick), { measure: width > 0 }))) + 4;
  /** The plot fills the measured width beside the axis labels; 0 until measured. */
  const plotWidth = width > 0 ? Math.max(0, width - AXIS_GAP_PX - axisWidth) : 0;
  const activePoint = points[active];
  const band = 100 / Math.max(1, points.length);
  const halfBar = `min(${MAX_BAR_PX / 2}px, ${(band * BAR_SHARE) / 2}%)`;
  const center = (i: number) => `${(i + 0.5) * band}%`;
  /** The value pill goes left of the active column when it fits, else right of it, then is kept inside the plot. Measured
      as it mounts, before paint, once the plot width is known. */
  const placePill = (el: HTMLSpanElement | null) => {
    if (!el) return;
    const pillWidth = el.offsetWidth;
    const bandPx = plotWidth / Math.max(1, points.length);
    const columnCenter = (active + 0.5) * bandPx;
    const halfBarPx = Math.min(MAX_BAR_PX / 2, (bandPx * BAR_SHARE) / 2);
    const leftSide = columnCenter - halfBarPx - PILL_GAP_PX - pillWidth;
    const preferred = leftSide >= 0 ? leftSide : columnCenter + halfBarPx + PILL_GAP_PX;
    el.style.left = `${Math.max(0, Math.min(preferred, plotWidth - pillWidth))}px`;
  };
  const labelHalf = (i: number) => Math.ceil(labelWidthPx(points[i]!.label) / 2);
  /** A column's label is centered on it but kept inside the plot, so the first and last labels can sit off-center. */
  const labelCenterPx = (i: number) => Math.min(Math.max(((i + 0.5) * plotWidth) / points.length, labelHalf(i)), plotWidth - labelHalf(i));
  const labelsFit = (every: number) => {
    let nextLeft = Infinity;
    for (let i = points.length - 1; i >= 0; i -= every) {
      if (labelCenterPx(i) + labelHalf(i) + LABEL_GAP_PX > nextLeft) return false;
      nextLeft = labelCenterPx(i) - labelHalf(i);
    }
    return true;
  };
  /** Every nth column is labelled, counted back from the newest so it always has one; n is the smallest that keeps the
      labels LABEL_GAP_PX apart. The labels wait for the measured width, as LineChart does, so they never overlap. */
  let labelEvery = 1;
  while (plotWidth && labelEvery < points.length && !labelsFit(labelEvery)) labelEvery++;

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * points.length);
    setHover(index >= 0 && index < points.length ? index : null);
  };

  return (
    <figure className="m-0">
      <div ref={chart} className="flex" style={{ gap: AXIS_GAP_PX }}>
        <div className="min-w-0 flex-1">
          <div className="relative touch-pan-y" data-swipe="off" style={{ height: PLOT_HEIGHT }} onPointerMove={onPointer} onPointerLeave={() => setHover(null)}>
            {ticks.map((tick) => (
              <span key={tick} aria-hidden="true" className="absolute inset-x-0 border-t border-[var(--grid)]" style={{ top: yOf(tick) }} />
            ))}
            {points.map((point, i) => (
              <span
                key={point.label}
                aria-hidden="true"
                className={`bar-grow absolute ${point.value < 0 ? "rounded-b-[4px]" : "rounded-t-[4px]"}`}
                style={{
                  left: `calc(${center(i)} - ${halfBar})`,
                  width: `calc(2 * ${halfBar})`,
                  top: Math.min(yOf(point.value), yOf(0)),
                  height: Math.abs(yOf(point.value) - yOf(0)),
                  transformOrigin: point.value < 0 ? "top" : undefined,
                  background: i === active ? "var(--s1-strong)" : "var(--s1)",
                  opacity: i !== active && partial.includes(i) ? PARTIAL_OPACITY : 1,
                  animationDelay: `${380 + i * 45}ms`,
                  transition: "background 200ms, opacity 200ms",
                }}
              />
            ))}
            {activePoint ? (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 border-t border-[var(--axis)] transition-[top,left] duration-200 ease-out motion-reduce:transition-none"
                  style={{ top: yOf(activePoint.value), left: center(active) }}
                />
                {plotWidth > 0 ? (
                  <span
                    ref={placePill}
                    className="tooltip pointer-events-none absolute z-10 -translate-y-1/2 px-2 py-1 text-[11.5px] font-medium whitespace-nowrap tabular-nums transition-[top,left] duration-200 ease-out motion-reduce:transition-none"
                    style={{ top: yOf(activePoint.value) }}
                  >
                    {periodPrefix ? `${periodPrefix} ` : ""}
                    {activePoint.label}: {formatValue(activePoint.value, format)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <div aria-hidden="true" className="relative mt-2 h-4">
            {points.map((point, i) =>
              plotWidth > 0 && (points.length - 1 - i) % labelEvery === 0 ? (
                <span
                  key={point.label}
                  className="absolute -translate-x-1/2 text-[12px] tracking-[-0.01em] whitespace-nowrap text-muted"
                  style={{ left: `clamp(${labelHalf(i)}px, ${center(i)}, calc(100% - ${labelHalf(i)}px))` }}
                >
                  {point.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
        <div aria-hidden="true" className="relative shrink-0" style={{ height: PLOT_HEIGHT, width: axisWidth }}>
          {ticks.map((tick) => (
            <span key={tick} className="absolute left-0 -translate-y-1/2 text-[12px] tracking-[-0.01em] whitespace-nowrap text-muted tabular-nums" style={{ top: yOf(tick) }}>
              {tickLabel(tick)}
            </span>
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{periodPrefix ? `${periodPrefix} …` : "Period"}</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <th scope="row">{point.label}</th>
                <td>{formatValue(point.value, format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Heights of the placeholder columns as shares of the plot, repeated: an uneven rise, as most monthly series have. */
const SKELETON_HEIGHTS = [0.42, 0.55, 0.48, 0.63, 0.57, 0.7, 0.62, 0.76, 0.69, 0.82, 0.74, 0.88];
/** Placeholder labels under the plot and beside it. */
const SKELETON_X_LABELS = 4;
const SKELETON_Y_LABELS = 4;

/** Loading placeholder of a ColumnChart with `columns` columns: the same plot height, column widths, axis gap and label
    rows, so it takes the chart's place at every width. */
export function ColumnChartSkeleton({ columns }: { columns: number }) {
  return (
    <div aria-hidden="true" className="flex" style={{ gap: AXIS_GAP_PX }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-end" style={{ height: PLOT_HEIGHT, paddingTop: TOP_PAD }}>
          {Array.from({ length: columns }, (_, i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center">
              <span
                className="skeleton rounded-t-[4px] rounded-b-none"
                style={{ width: `${BAR_SHARE * 100}%`, maxWidth: MAX_BAR_PX, height: `${SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]! * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex h-4 items-center justify-between">
          {Array.from({ length: SKELETON_X_LABELS }, (_, i) => (
            <span key={i} className="skeleton h-3 w-9" />
          ))}
        </div>
      </div>
      <div className="flex w-8 shrink-0 flex-col justify-between" style={{ height: PLOT_HEIGHT, paddingTop: TOP_PAD / 2 }}>
        {Array.from({ length: SKELETON_Y_LABELS }, (_, i) => (
          <span key={i} className="skeleton h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
