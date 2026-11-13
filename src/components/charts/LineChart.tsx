"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { smoothPath } from "@/components/charts/smooth-path";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { formatDate, formatShortDate } from "@/lib/format";
import { AXIS_UNIT_MIN_WIDTH, axisDigits, formatAxisValue, formatMonth, formatValue, labelWidthPx, niceTicks, SERIES_COLORS, type ValueFormat } from "./chart-format";
import type { ChartMarker } from "./milestones";

type LinePoint = { time: number; value: number };
type LineSeries = { name: string; points: LinePoint[] };

type LineChartProps = {
  series: LineSeries[];
  format: ValueFormat;
  title: string;
  height?: number;
  /** Start the y axis at zero instead of the data minimum. */
  zeroBaseline?: boolean;
  /** Dated events drawn as dashed lines; ones outside the plotted range are left out. */
  markers?: ChartMarker[];
  /** Show the series legend above a multi-series chart; off when the panel already names the series in its own colors. */
  legend?: boolean;
  /** Each point is a calendar month at its first day, so the tooltip and table name the month, not that day. */
  monthly?: boolean;
};

const PAD = { left: 48, right: 8, top: 10, bottom: 26 };
const TABLE_ROWS = 24;
/** Space kept between two month labels on the x axis. */
const X_LABEL_GAP = 16;
/** Most month labels on the x axis. */
const MAX_X_LABELS = 5;
/** Gap between a single series' end dot and its value label. */
const END_LABEL_GAP = 8;
/** Opacity of the wash under the first series. */
const AREA_OPACITY = 0.24;
/** Gap between the hovered point and its tooltip. */
const TOOLTIP_GAP = 12;
/** Font size of a marker's label. */
const MARKER_LABEL_PX = 11;
/** Gap between a marker's line and its label. */
const MARKER_LABEL_GAP = 5;

/** Month labels at evenly spaced times from t0 to t1, each centered on its date but kept inside the chart's width: the most
    (up to MAX_X_LABELS) that stay X_LABEL_GAP apart. A short series can give the same month twice, so each is kept once. */
function monthLabels(t0: number, t1: number, xOf: (time: number) => number, width: number) {
  for (let count = MAX_X_LABELS; count >= 1; count--) {
    const labels = Array.from({ length: count }, (_, i) => {
      const time = count === 1 ? t1 : t0 + ((t1 - t0) * i) / (count - 1);
      const text = formatMonth(time);
      const half = Math.ceil(labelWidthPx(text) / 2);
      return { text, half, x: Math.min(Math.max(xOf(time), half), width - half) };
    }).filter((label, i, all) => all.findIndex((other) => other.text === label.text) === i);
    if (labels.every((label, i) => i === 0 || label.x - label.half - (labels[i - 1]!.x + labels[i - 1]!.half) >= X_LABEL_GAP)) return labels;
  }
  return [];
}

/** Up to three series on one y axis as smooth curves, the first over a light wash, each ending in a dot, with a crosshair
    tooltip. A single series also prints its newest value at its end. Series share time stamps by index. */
export function LineChart({ series, format, title, height = 240, zeroBaseline = false, markers = [], legend = true, monthly = false }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const base = useMemo(() => series[0]?.points ?? [], [series]);
  const single = series.length === 1;
  const endLabel = single && base.length > 0 ? formatValue(base.at(-1)!.value, format) : null;
  const { ticks, tickLabel, left, right, xOf, yOf } = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.value));
    /** A zero baseline still reaches below zero when a value is negative, and up to zero when every value is. */
    const min = zeroBaseline ? Math.min(0, ...values) : Math.min(...values);
    const max = zeroBaseline ? Math.max(0, ...values) : Math.max(...values);
    const yTicks = niceTicks(min, max);
    const lo = yTicks[0] ?? 0;
    const hi = yTicks.at(-1) ?? 1;
    const t0 = base[0]?.time ?? 0;
    const t1 = base.at(-1)?.time ?? 1;
    const digits = axisDigits(yTicks, format);
    const label = (tick: number) => formatAxisValue(tick, format, digits, width >= AXIS_UNIT_MIN_WIDTH);
    const labelPx = Math.max(...yTicks.map((t) => labelWidthPx(label(t))));
    const plotLeft = Math.max(PAD.left, labelPx + 12);
    const plotRight = endLabel ? labelWidthPx(endLabel, { weight: 700 }) + END_LABEL_GAP + 4 : PAD.right;
    const plotW = Math.max(1, width - plotLeft - plotRight);
    const plotH = height - PAD.top - PAD.bottom;
    return {
      ticks: yTicks,
      tickLabel: label,
      left: plotLeft,
      right: plotRight,
      xOf: (t: number) => plotLeft + ((t - t0) / (t1 - t0 || 1)) * plotW,
      yOf: (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH,
    };
  }, [series, base, width, height, zeroBaseline, format, endLabel]);
  /** The curves change with the data and the size, not with the hovered point. */
  const paths = useMemo(() => series.map((s) => smoothPath(s.points.map((p) => ({ x: xOf(p.time), y: yOf(p.value) })))), [series, xOf, yOf]);

  /** A line needs two points; until then the chart's space holds a note, so the panel keeps its size and says why. */
  if (base.length < 2) {
    return (
      <p className="m-0 grid place-items-center text-center text-[13px] text-ink-2" style={{ height }}>
        The chart appears once a second data point is stored.
      </p>
    );
  }

  const xLabels = monthLabels(base[0]!.time, base.at(-1)!.time, xOf, width);
  const floor = yOf(ticks[0] ?? 0);
  /** Day labels carry the year when the chart crosses a calendar year, so the same day in two years never reads alike. */
  const dayLabel = new Date(base[0]!.time * 1000).getUTCFullYear() === new Date(base.at(-1)!.time * 1000).getUTCFullYear() ? formatShortDate : formatDate;
  const pointLabel = monthly ? formatMonth : dayLabel;

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    /** Points are in time order: the first at or right of the pointer, or the one before it when that is as close. */
    let after = 0;
    let end = base.length - 1;
    while (after < end) {
      const mid = (after + end) >> 1;
      if (xOf(base[mid]!.time) < x) after = mid + 1;
      else end = mid;
    }
    setHover(after > 0 && x - xOf(base[after - 1]!.time) <= xOf(base[after]!.time) - x ? after - 1 : after);
  };

  const hoverPoint = hover === null ? null : base[hover];
  /** Beside the hovered point, on the side with more room, then kept inside the chart: a wide tooltip on a narrow chart
      would otherwise run past its edge. Measured as it mounts, before paint. */
  const placeTooltip = (x: number) => (el: HTMLDivElement | null) => {
    if (!el) return;
    const tipWidth = el.offsetWidth;
    const preferred = x > width / 2 ? x - TOOLTIP_GAP - tipWidth : x + TOOLTIP_GAP;
    el.style.left = `${Math.max(0, Math.min(preferred, width - tipWidth))}px`;
  };
  const step = Math.max(1, Math.ceil(base.length / TABLE_ROWS));
  const shownMarkers = markers.filter((m) => m.time >= base[0]!.time && m.time <= base.at(-1)!.time);
  /** A marker label's text anchor: on the side of its line with more room, else the other side, between the y axis labels
      and the plot's right edge; null when it fits on neither side. */
  const markerAnchor = (x: number, text: string): "start" | "end" | null => {
    const room = labelWidthPx(text, { size: MARKER_LABEL_PX }) + MARKER_LABEL_GAP;
    const fitsLeft = x - room >= left;
    const fitsRight = x + room <= width - right;
    if (x > width / 2) return fitsLeft ? "end" : fitsRight ? "start" : null;
    return fitsRight ? "start" : fitsLeft ? "end" : null;
  };

  return (
    <figure className="m-0">
      {!single && legend ? (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[12px] font-medium text-ink-2">
          {series.map((s, i) => (
            <span key={s.name} className="chip">
              <span aria-hidden="true" className="size-2 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} aria-hidden="true" className="block touch-pan-y" data-swipe="off" onPointerMove={onPointer} onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - right} y1={yOf(t)} y2={yOf(t)} stroke="var(--grid)" />
                <text x={left - 10} y={yOf(t) + 4} textAnchor="end" className="fill-[var(--muted)] text-[12px] tracking-[-0.01em] tabular-nums">
                  {tickLabel(t)}
                </text>
              </g>
            ))}
            {xLabels.map((label) => (
              <text key={label.text} x={label.x} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[12px] tracking-[-0.01em]">
                {label.text}
              </text>
            ))}
            {shownMarkers.map((m) => {
              const x = xOf(m.time);
              const anchor = markerAnchor(x, m.label);
              return (
                <g key={m.label}>
                  <line x1={x} x2={x} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--axis)" strokeDasharray="4 4" />
                  {anchor ? (
                    <text
                      x={anchor === "end" ? x - MARKER_LABEL_GAP : x + MARKER_LABEL_GAP}
                      y={PAD.top + 10}
                      textAnchor={anchor}
                      className="fill-[var(--muted)]"
                      style={{ fontSize: MARKER_LABEL_PX }}
                    >
                      {m.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <g className="draw-x">
              {series.map((s, i) => {
                const d = paths[i]!;
                const first = s.points[0]!;
                const last = s.points.at(-1)!;
                return (
                  <g key={s.name}>
                    {i === 0 ? <path d={`${d}L${xOf(last.time)},${floor}L${xOf(first.time)},${floor}Z`} fill={SERIES_COLORS[0]} fillOpacity={AREA_OPACITY} /> : null}
                    <path d={d} fill="none" stroke={SERIES_COLORS[i]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={xOf(last.time)} cy={yOf(last.value)} r="4" fill={SERIES_COLORS[i]} stroke="var(--surface)" strokeWidth="2" />
                  </g>
                );
              })}
              {endLabel ? (
                <text x={xOf(base.at(-1)!.time) + END_LABEL_GAP} y={yOf(base.at(-1)!.value) + 4} className="fill-[var(--ink)] text-[12px] font-bold tabular-nums">
                  {endLabel}
                </text>
              ) : null}
            </g>
            {hoverPoint ? (
              <g>
                <line x1={xOf(hoverPoint.time)} x2={xOf(hoverPoint.time)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--axis)" />
                {series.map((s, i) => {
                  const p = s.points[hover!];
                  return p ? (
                    <circle key={`${s.name}-${hover}`} cx={xOf(p.time)} cy={yOf(p.value)} r="4.5" fill={SERIES_COLORS[i]} stroke="var(--surface)" strokeWidth="2" className="pop" style={{ transformOrigin: `${xOf(p.time)}px ${yOf(p.value)}px` }} />
                  ) : null;
                })}
              </g>
            ) : null}
          </svg>
        ) : null}
        {hoverPoint ? (
          <div
            ref={placeTooltip(xOf(hoverPoint.time))}
            className="tooltip pointer-events-none absolute top-1 z-10 px-2.5 py-1.5 text-[12px] whitespace-nowrap"
          >
            <span className="block text-[11.5px] font-medium opacity-70">{pointLabel(hoverPoint.time)}</span>
            {series.map((s, i) => {
              const p = s.points[hover!];
              return p ? (
                <span key={s.name} className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                  {!single ? <span aria-hidden="true" className="size-2 rounded-[3px] ring-1 ring-white/40" style={{ background: SERIES_COLORS[i] }} /> : null}
                  {!single ? <span className="opacity-70">{s.name}</span> : null}
                  {formatValue(p.value, format)}
                </span>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
      <div className="sr-only">
        <table>
          <caption>
            {title}
            {shownMarkers.map((m) => `. ${m.label}: ${dayLabel(m.time)}`).join("")}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {base
              .filter((_, i) => i % step === 0 || i === base.length - 1)
              .map((p) => {
                const index = base.indexOf(p);
                return (
                  <tr key={p.time}>
                    <th scope="row">{pointLabel(p.time)}</th>
                    {series.map((s) => (
                      <td key={s.name}>{s.points[index] ? formatValue(s.points[index]!.value, format) : ""}</td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Outline of the placeholder curve's area over the plot: a rise from left to right with dips. */
const SKELETON_AREA = "polygon(0 72%, 10% 64%, 20% 68%, 30% 52%, 40% 58%, 50% 44%, 60% 50%, 70% 34%, 80% 40%, 90% 24%, 100% 18%, 100% 100%, 0 100%)";
/** Placeholder labels on each axis. */
const SKELETON_Y_LABELS = 4;
const SKELETON_X_LABELS = 4;

/** Loading placeholder of a LineChart: the legend chips (`legend`, each series name's length, for a multi-series chart that
    shows its legend), then a plot of the same height and padding with an area in place of the curve. */
export function LineChartSkeleton({ height = 240, legend = [] }: { height?: number; legend?: number[] }) {
  return (
    <div aria-hidden="true">
      {legend.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[12px] font-medium">
          {legend.map((chars, i) => (
            <span key={i} className="chip">
              <span className="skeleton size-2 rounded-[3px]" />
              <SkeletonWords chars={chars} />
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative" style={{ height }}>
        <div className="absolute left-0 flex flex-col justify-between" style={{ top: PAD.top, bottom: PAD.bottom, width: PAD.left - 10 }}>
          {Array.from({ length: SKELETON_Y_LABELS }, (_, i) => (
            <span key={i} className="skeleton h-3 w-full" />
          ))}
        </div>
        <span className="skeleton absolute rounded-none" style={{ top: PAD.top, right: PAD.right, bottom: PAD.bottom, left: PAD.left, clipPath: SKELETON_AREA }} />
        <div className="absolute bottom-0 flex justify-between" style={{ left: PAD.left, right: PAD.right }}>
          {Array.from({ length: SKELETON_X_LABELS }, (_, i) => (
            <span key={i} className="skeleton h-3 w-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
