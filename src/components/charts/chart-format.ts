import { formatCompact, formatMultiple, formatNear, formatPercent, formatUsd } from "@/lib/format";
import { dayTime } from "@/lib/metrics";

export type ValueFormat = "usd" | "number" | "percent" | "near" | "index" | "multiple";

/** Canvas context that measures labels in the page's font: undefined until first used, null when canvas is unavailable. */
let measureContext: CanvasRenderingContext2D | null | undefined;
/** The body's font family, read once. */
let bodyFontFamily: string | undefined;
/** Width of the widest digit for each canvas font string. */
const digitWidths = new Map<string, number>();

/** Estimated width of a label in Inter: capitals are wider than digits and lower case, dots and spaces narrower. */
function estimateWidthPx(text: string, size: number): number {
  let px = 0;
  for (const char of text) px += /[A-Z%]/.test(char) ? 8.4 : /[.,:\s]/.test(char) ? 3.6 : 7;
  return Math.ceil((px * size) / 12);
}

/** Width in pixels of a label, measured in the body's font in the browser (digits at the widest digit's width, as tabular
    figures set them) and estimated on the server. `measure` false keeps the estimate, so markup rendered before the
    chart is measured hydrates unchanged. */
export function labelWidthPx(text: string, { weight = 400, size = 12, measure = true }: { weight?: number; size?: number; measure?: boolean } = {}): number {
  if (!measure || typeof document === "undefined") return estimateWidthPx(text, size);
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return estimateWidthPx(text, size);
  const context = measureContext;
  bodyFontFamily ??= getComputedStyle(document.body).fontFamily;
  context.font = `${weight} ${size}px ${bodyFontFamily}`;
  let digit = digitWidths.get(context.font);
  if (digit === undefined) {
    digit = Math.max(..."0123456789".split("").map((d) => context.measureText(d).width));
    digitWidths.set(context.font, digit);
  }
  const digits = text.replace(/\D/g, "").length;
  return Math.ceil(context.measureText(text.replace(/\d/g, "")).width + digits * digit);
}

export function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case "usd":
      return formatUsd(value);
    case "percent":
      return formatPercent(value, 1);
    case "near":
      return formatNear(value, 2);
    case "index":
      return value.toFixed(0);
    case "multiple":
      return formatMultiple(value);
    default:
      return formatCompact(value);
  }
}

/** The number an axis prints for a tick before its unit: percentages for percent ticks, the value itself otherwise. */
const axisNumber = (value: number, format: ValueFormat) => (format === "percent" ? value * 100 : value);

/** Fewest decimals (usually at most 3) at which every tick prints exactly in compact form: 0 for 80%, 3 for 1.225B. Past 3
    only while two ticks would still print alike (1.0005M and 1.001M), so every gridline keeps its own label. */
export function axisDigits(ticks: number[], format: ValueFormat): number {
  const exactAt = (tick: number, digits: number) => {
    const value = Math.abs(axisNumber(tick, format));
    const unit = value >= 1000 ? 1000 ** Math.floor(Math.log10(value) / 3) : 1;
    const scaled = (value / unit) * 10 ** digits;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6;
  };
  for (let digits = 0; digits < 3; digits++) if (ticks.every((tick) => exactAt(tick, digits))) return digits;
  let digits = 3;
  while (digits < 6 && new Set(ticks.map((tick) => formatAxisValue(tick, format, digits))).size < ticks.length) digits++;
  return digits;
}

/** Narrowest chart whose y axis labels carry the NEAR unit; narrower charts leave it to the chart's title. */
export const AXIS_UNIT_MIN_WIDTH = 480;

/** An axis tick label in compact form without trailing zeros (80%, 1.25K%, $0, $100M, 1.225B NEAR), with the decimals
    `axisDigits` gives so each label names its gridline exactly. `withUnit` false leaves " NEAR" off, for narrow charts
    whose title names the unit. */
export function formatAxisValue(value: number, format: ValueFormat, digits: number, withUnit = true): string {
  const compact = formatCompact(Math.abs(axisNumber(value, format)), digits);
  const sign = value < 0 ? "−" : "";
  switch (format) {
    case "usd":
      return `${sign}$${compact}`;
    case "percent":
      return `${sign}${compact}%`;
    case "near":
      return withUnit ? `${sign}${compact} NEAR` : `${sign}${compact}`;
    case "multiple":
      return `${sign}${compact}×`;
    default:
      return `${sign}${compact}`;
  }
}

/** Ticks an axis aims for; rounding the step to a nice number can give one more or fewer. */
const TICK_COUNT = 4;

/** Evenly spaced, rounded axis ticks covering [min, max]. Each is a whole multiple of the step, so the tick at zero is exactly 0. */
export function niceTicks(min: number, max: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const m = raw / magnitude;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let i = Math.floor(min / step); i * step <= max + step * 0.999; i++) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}

export const SERIES_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)"] as const;

/** "Oct 2026" in UTC. */
export function formatMonth(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2026-10" → Unix seconds at 00:00 UTC on the month's first day. */
export const monthStart = (month: string) => dayTime(`${month}-01`);

/** "2026-10" → "Oct 26", the column label of a calendar month (UTC). */
export const monthLabel = (month: string) =>
  new Date(monthStart(month) * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
