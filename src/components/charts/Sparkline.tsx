import { useId } from "react";
import { smoothPath } from "@/components/charts/smooth-path";

const WIDTH = 100;
const HEIGHT = 40;
const STROKE_PAD = 4;
/** Room at each side so the end dot is not cut off by the box or a clip-path reveal. */
const SIDE_PAD = 6;
const COLOR = "var(--s1)";
/** Most points drawn: more than a card-sized sparkline can show apart, so a longer series is thinned evenly. */
const MAX_POINTS = 120;

/** `values` thinned to at most MAX_POINTS evenly spaced ones, keeping the first and the last. */
const thinned = (values: number[]) =>
  values.length <= MAX_POINTS ? values : Array.from({ length: MAX_POINTS }, (_, i) => values[Math.round((i * (values.length - 1)) / (MAX_POINTS - 1))]!);

/** Decorative smooth area chart of a series: a green line over a fill that fades out downwards, ending in a dot. Stretches
    to its box; the dot is a round line cap with a non-scaling stroke, so it stays round when the box is stretched. */
export function Sparkline({ values: series, className }: { values: number[]; className?: string }) {
  const fillId = useId();
  const values = thinned(series);
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const points = values.map((value, i) => ({
    x: SIDE_PAD + (i / (values.length - 1)) * (WIDTH - SIDE_PAD * 2),
    y: STROKE_PAD + (1 - (value - lo) / span) * (HEIGHT - STROKE_PAD * 2),
  }));
  const line = smoothPath(points);
  const end = points.at(-1)!;
  const dot = `M${end.x},${end.y}h0`;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" className={`overflow-visible ${className ?? ""}`}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: COLOR, stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: COLOR, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${line}L${end.x},${HEIGHT}L${SIDE_PAD},${HEIGHT}Z`} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={dot} stroke="var(--surface)" strokeWidth="11" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={dot} stroke={COLOR} strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
