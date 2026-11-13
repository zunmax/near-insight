/** Compact USD and number formatters by maximum decimals, created on first use. */
const usdCompact = new Map<number, Intl.NumberFormat>();
const numberCompact = new Map<number, Intl.NumberFormat>();
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const smallDecimal = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/** $4.47B, $240.37M, $5.15, −$12.30: compact once the amount rounds to $1,000, so $999.996 reads "$1K"; `digits` is the most
    decimals shown, $12.345M with 3. */
export function formatUsd(value: number, digits = 2): string {
  const amount = Math.abs(value);
  let compact = usdCompact.get(digits);
  if (!compact) {
    compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: digits });
    usdCompact.set(digits, compact);
  }
  const text = roundTo(amount, digits) >= 1000 ? compact.format(amount) : `$${roundTo(amount, digits).toFixed(digits)}`;
  return roundTo(value, digits) < 0 ? `−${text}` : text;
}

/** Fewest decimals, from 2 up to 5, at which formatUsd prints `a` and `b` apart, so two amounts that differ never print alike. */
export function usdDigitsApart(a: number, b: number): number {
  for (let d = 2; d <= 5; d++) if (formatUsd(a, d) !== formatUsd(b, d)) return d;
  return 2;
}

/** Amounts under a cent to three significant digits, larger ones as formatUsd: 0.000412 → "$0.000412", 0.25 → "$0.25". */
export function formatSmallUsd(value: number): string {
  const amount = Math.abs(value);
  return amount > 0 && amount < 0.01 ? `${value < 0 ? "−" : ""}$${smallDecimal.format(amount)}` : formatUsd(value);
}

/** `value` rounded half away from zero to `digits` decimals as it will print, so a sign or a comparison follows the shown number
    (−0.001 → 0). Binary noise is cleared first, so 0.5 × 3.61 (stored as 1.80499…) rounds to 1.81 like the true 1.805. */
function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  const scaled = Number(Math.abs(value * scale).toPrecision(12));
  const rounded = (Math.sign(value) * Math.round(scaled)) / scale;
  return rounded === 0 ? 0 : rounded;
}

/** A non-negative number with exactly `digits` decimals and thousands grouped: 22823.4 → "22,823.40" with 2 digits. */
const grouped = (value: number, digits: number) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** A share as a percentage rounded to `digits`, e.g. 0.02481 → 2.48 with 2 digits. */
export const percentRounded = (share: number, digits: number) => roundTo(share * 100, digits);

/** Fewest decimals, from `digits` up to `digits + 3`, at which `a` and `b` round apart, so two values that differ print alike
    only when they are closer than those extra decimals can show. */
export function digitsApart(a: number, b: number, digits: number): number {
  for (let d = digits; d <= digits + 3; d++) if (roundTo(a, d) !== roundTo(b, d)) return d;
  return digits;
}

/** "last 30 days" → "Last 30 days", for a phrase that starts a label. */
export const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The word for how `a` compares with `b`, e.g. compareWord(5, 3, "above", "below", "level with") → "above". */
export const compareWord = (a: number, b: number, more: string, less: string, same: string) => (a > b ? more : a < b ? less : same);

/** 1 → "1 validator", 337 → "337 validators" */
export function formatCount(count: number, singular: string): string {
  return `${integer.format(count)} ${count === 1 ? singular : `${singular}s`}`;
}

/** 0.0248 → "2.48%", 22.5 → "2,250.00%" */
export function formatPercent(share: number, digits = 2): string {
  const shown = percentRounded(share, digits);
  return `${shown < 0 ? "−" : ""}${grouped(Math.abs(shown), digits)}%`;
}

/** A share with at least `digits` decimals and up to three more, so one just short of whole prints below 100%: 0.998 → "99.8%". */
export const formatPercentFromFull = (share: number, digits: number) => formatPercent(share, digitsApart(share * 100, 100, digits));

/** A share as `formatPercentFromFull` prints it and its two parts, which add up to it as printed: the second part is the rounded
    total less the rounded first, so it can differ from its own rounding by one in the last digit. */
export function formatPercentSplit(total: number, first: number, digits: number): [total: string, first: string, second: string] {
  const d = digitsApart(total * 100, 100, digits);
  const second = (percentRounded(total, d) - percentRounded(first, d)) / 100;
  return [formatPercent(total, d), formatPercent(first, d), formatPercent(second, d)];
}

/** 0.614 → "+61.4%", −0.0004 → "0.0%" */
export function formatChange(share: number, digits = 1): string {
  const shown = percentRounded(share, digits);
  const sign = shown > 0 ? "+" : shown < 0 ? "−" : "";
  return `${sign}${grouped(Math.abs(shown), digits)}%`;
}

/** 1.25 → "up 125%", −0.85 → "down 85%", anything that rounds to 0% → "unchanged" */
function formatMove(share: number, digits = 0): string {
  const shown = percentRounded(share, digits);
  return shown === 0 ? "unchanged" : `${shown > 0 ? "up" : "down"} ${formatPercent(Math.abs(share), digits)}`;
}

/** A change with up to three decimals, so one of 0.0005% or more never reads "unchanged": −0.004 → "down 0.4%", −0.25 → "down 25%". */
export const formatMoveFromZero = (change: number) => formatMove(change, digitsApart(change * 100, 0, 0));

/** A whole-percent change with up to three decimals, so one of 0.0005% or more never prints as 0: 0.004 → "+0.4%". */
export const formatChangeFromZero = (change: number) => formatChange(change, digitsApart(change * 100, 0, 0));

/** 0.012 → "grew 1.2%", −0.012 → "shrank 1.2%", anything that rounds to 0% → "was unchanged" */
export function formatGrowth(change: number, digits: number): string {
  const shown = percentRounded(change, digits);
  return shown === 0 ? "was unchanged" : `${shown > 0 ? "grew" : "shrank"} ${formatPercent(Math.abs(change), digits)}`;
}

/** A range of monthly rates → "+9.7% to +31.1%" */
export function formatGrowthRange(range: { low: number; high: number }, digits: number): string {
  return `${formatChange(range.low, digits)} to ${formatChange(range.high, digits)}`;
}

/** Two 90-day totals, their change, its monthly rate and that rate's 95% range → "1.2M NEAR, up 71% from 703K NEAR in the 90 days
    before, a pace of 19.6% growth a month (95% range +9.7% to +31.1% a month)" */
export function formatPace90d(latest: string, prior: string, change90d: number, monthlyRate: number, rateDigits: number, range: { low: number; high: number } | null): string {
  const pace = percentRounded(monthlyRate, rateDigits);
  const paceText = pace === 0 ? "no growth a month" : `a pace of ${formatPercent(Math.abs(monthlyRate), rateDigits)} ${pace > 0 ? "growth" : "decline"} a month`;
  const rangeText = range ? ` (95% range ${formatGrowthRange(range, rateDigits)} a month)` : "";
  /** A pace that shows a change needs a move that shows one too, so a small change never reads "unchanged" beside it. */
  return `${latest}, ${pace === 0 ? formatMove(change90d) : formatMoveFromZero(change90d)} from ${prior} in the 90 days before, ${paceText}${rangeText}`;
}

/** 0.143 → "+0.14", −0.041 → "−0.04", −0.001 → "0.00" (a correlation coefficient) */
export function formatCorrelation(r: number): string {
  const shown = roundTo(r, 2);
  return `${shown > 0 ? "+" : shown < 0 ? "−" : ""}${Math.abs(shown).toFixed(2)}`;
}

/** 1545.7 → "1,546×", 0.962 with 2 digits → "0.96×": a ratio printed in full, never shortened to "2K×" */
export function formatMultiple(value: number, digits = 0): string {
  /** More decimals only while the value would print as 0×; the minus is the same sign the other formatters print. */
  const shown = digitsApart(value, 0, digits);
  const rounded = roundTo(value, shown);
  return `${rounded < 0 ? "−" : ""}${grouped(Math.abs(rounded), shown)}×`;
}

/** 0.2063 → "0.206", 0.0004 → "< 0.001", 0.0504 against alpha 0.05 → "0.0504": decimals enough to tell `p` from `alpha`. */
export function formatPValue(p: number, alpha: number): string {
  const digits = digitsApart(p, alpha, 3);
  return p < 0.001 ? "< 0.001" : roundTo(p, digits).toFixed(digits);
}

/** 0.00038 → "3.8 bps" */
export function formatBps(share: number): string {
  const shown = roundTo(share * 10_000, 1);
  return `${shown < 0 ? "−" : ""}${Math.abs(shown).toFixed(1)} bps`;
}

/** 1_309_614_393 → "1.3B" (or "1.31B" with 2 digits), −12_300 → "−12.3K", with the same minus sign as formatChange */
export function formatCompact(value: number, digits = 1): string {
  let formatter = numberCompact.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits });
    numberCompact.set(digits, formatter);
  }
  const text = formatter.format(Math.abs(value));
  return value < 0 && text !== "0" ? `−${text}` : text;
}

/** 2_164_886.4 → "2.2M NEAR" (or "2.16M NEAR" with 2 digits) */
export function formatNear(value: number, digits = 1): string {
  return `${formatCompact(value, digits)} NEAR`;
}

/** A positive amount as formatNear, or "less than 0.1 NEAR" when it would print as 0, so a small amount never reads as none. */
export function formatNearAboveZero(value: number): string {
  const text = formatNear(value);
  return value > 0 && Number.parseFloat(text) === 0 ? "less than 0.1 NEAR" : text;
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** 14327.2834519 → "14,327.283", 0.000412 → "0.000412": grouped, up to three decimals, and three significant digits below 0.001 so small values do not show as 0; no unit (raw query values) */
export function formatDecimal(value: number): string {
  return value !== 0 && Math.abs(value) < 0.001 ? smallDecimal.format(value) : decimal.format(value);
}

/** "2026-02-23" → "February 2026" */
export function formatMonthYear(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** A span in months as people say it: 24 → "2 years", 12 → "1 year", 3 → "3 months", 18 → "18 months". */
export function formatMonths(months: number): string {
  return months > 0 && months % 12 === 0 ? formatCount(months / 12, "year") : formatCount(months, "month");
}

/** Unix seconds → "Oct 20" in UTC. */
export function formatShortDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Unix seconds → "Oct 20, 2026" in UTC. */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** ISO time → "2026-10-21 12:25 UTC": the UTC day as every date in the thesis is written, then the time. */
export function formatDateTimeUtc(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 10)} ${formatUtcTime(iso)}`;
}

/** ISO time → "11:00 UTC" */
export function formatUtcTime(iso: string): string {
  return `${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}
