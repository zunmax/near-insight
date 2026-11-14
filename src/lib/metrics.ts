/** Pure calculations behind the thesis metrics. Inputs come from src/data; no I/O here. */

export type DailyPoint = { time: number; value: number };

export const DAY_SECONDS = 86_400;

/** Days in the month every per-month figure uses: a twelfth of a 365-day year, as issuance and 30-day flows are scaled. */
export const DAYS_PER_MONTH = 365 / 12;
export const YEAR_SECONDS = 365 * DAY_SECONDS;

/** NEAR paid for `tgas` teragas at a gas price in yoctoNEAR per gas. */
export function gasCostNear(gasPriceYocto: number, tgas: number): number {
  return (gasPriceYocto * tgas * 1e12) / 1e24;
}

/** Smallest number of validators whose combined stake exceeds `threshold` of the total. A stake exactly at the threshold
    does not exceed it, even when float sums land a hair above it (three stakes of 3.3 at 1/3), hence the relative tolerance. */
export function nakamotoCoefficient(stakesDesc: number[], threshold: number): number {
  const total = stakesDesc.reduce((sum, stake) => sum + stake, 0);
  let running = 0;
  for (let i = 0; i < stakesDesc.length; i++) {
    running += stakesDesc[i] ?? 0;
    if (running - total * threshold > total * 1e-12) return i + 1;
  }
  return stakesDesc.length;
}

/** Gross staking yield before validator commission: the NEAR minted a year, less the treasury's share, ÷ the NEAR staked. */
export function grossStakingYield(mintedNearPerYear: number, treasuryShare: number, stakedNear: number): number | null {
  return stakedNear > 0 ? (mintedNearPerYear * (1 - treasuryShare)) / stakedNear : null;
}

/** Yield after dilution: a nominal yearly yield deflated by a yearly supply growth rate, (1 + nominal) ÷ (1 + inflation) − 1. */
export function realYield(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Sums `daily` into `count` consecutive windows of `windowDays`, ending at the latest point. */
export function rollingWindows(daily: DailyPoint[], windowDays: number, count: number): Array<{ end: number; value: number }> {
  const last = daily.at(-1);
  if (!last) return [];
  const windows = Array.from({ length: count }, (_, i) => {
    const end = last.time - (count - 1 - i) * windowDays * DAY_SECONDS;
    return { end, start: end - windowDays * DAY_SECONDS, value: 0 };
  });
  for (const point of daily) {
    const window = windows.find((w) => point.time > w.start && point.time <= w.end);
    if (window) window.value += point.value;
  }
  return windows.map(({ end, value }) => ({ end, value }));
}

/** Value of the last point at or before `time`, or the first point if none precede it. */
export function valueAt(daily: DailyPoint[], time: number): number {
  let found = daily[0]?.value ?? 0;
  for (const point of daily) {
    if (point.time > time) break;
    found = point.value;
  }
  return found;
}

/** Sum over the `days` calendar days ending `offsetDays` before `endTime` (default: the latest point), by date,
    so series that end on different days can be compared over the same window. */
export function sumWindow(daily: DailyPoint[], days: number, offsetDays = 0, endTime = daily.at(-1)?.time ?? 0): number {
  const end = endTime - offsetDays * DAY_SECONDS;
  const start = end - days * DAY_SECONDS;
  return daily.reduce((sum, point) => (point.time > start && point.time <= end ? sum + point.value : sum), 0);
}

/** A 30-day flow against the same 30 days a year earlier. */
export type FlowYoY = { last30d: number; yearAgo30d: number; change: number | null };

/** 30-day flow against the same 30 days a year earlier, ending at `end`; change is null unless both windows have every day. */
export function flowYoY(daily: DailyPoint[], end: number): FlowYoY {
  const last30d = sumWindow(daily, 30, 0, end);
  const yearAgo30d = sumWindow(daily, 30, 365, end);
  const covered = coversWindow(daily, 30, 0, end) && coversWindow(daily, 30, 365, end);
  return { last30d, yearAgo30d, change: covered && yearAgo30d > 0 ? last30d / yearAgo30d - 1 : null };
}

/** Relative change of the last `days` against the `days` before them, ending at `endTime`; null when the earlier window's sum is not positive. */
export function windowChange(daily: DailyPoint[], days: number, endTime = daily.at(-1)?.time ?? 0): number | null {
  const previous = sumWindow(daily, days, days, endTime);
  return previous > 0 ? sumWindow(daily, days, 0, endTime) / previous - 1 : null;
}

/** Latest day all `series` have data for (unix seconds): the shared end of windows that compare them. */
export function commonEnd(...series: DailyPoint[][]): number {
  return Math.min(...series.map((daily) => daily.at(-1)?.time ?? 0));
}

/** `series` preceded by the points of `history` from before its first day; empty while `series` is. */
export function extendBack(series: DailyPoint[], history: DailyPoint[]): DailyPoint[] {
  const first = series[0]?.time;
  return first === undefined ? [] : [...history.filter((point) => point.time < first), ...series];
}

/** Daily USD amounts converted to NEAR at that day's price; days before the first price are left out. */
export function toNear(usdDaily: DailyPoint[], priceUsd: DailyPoint[]): DailyPoint[] {
  const firstPrice = priceUsd[0]?.time ?? Infinity;
  return usdDaily.flatMap((point) => {
    const price = point.time >= firstPrice ? valueAt(priceUsd, point.time) : 0;
    return price > 0 ? [{ time: point.time, value: point.value / price }] : [];
  });
}

/** Days a level series' history may fall short of a change's window: CoinGecko serves at most 365 days of prices. */
const LEVEL_HISTORY_SLACK_DAYS = 2;

/** Relative change of a level series (supply, TVL) over `days`, from the first level when the history is up to LEVEL_HISTORY_SLACK_DAYS short; null when shorter. */
export function levelChange(daily: DailyPoint[], days: number): number | null {
  const last = daily.at(-1);
  const first = daily[0];
  if (!last || !first || last.time - first.time < (days - LEVEL_HISTORY_SLACK_DAYS) * DAY_SECONDS) return null;
  const before = valueAt(daily, last.time - days * DAY_SECONDS);
  return before > 0 ? last.value / before - 1 : null;
}

/** Yearly growth of a level series between the medians of the `endDays` readings at each end, so one off reading cannot
    swing it: the last `endDays` days against the `endDays` ending 365 days earlier, or the first `endDays` days when the
    history is shorter, scaled to 365 days. Null when the two windows would overlap or the earlier median is not positive. */
export function yearlyGrowthOfMedians(daily: DailyPoint[], endDays: number): number | null {
  const first = daily[0];
  const last = daily.at(-1);
  if (!first || !last) return null;
  const window = (endDays - 1) * DAY_SECONDS;
  const yearBefore = last.time - YEAR_SECONDS;
  const baseEnd = first.time <= yearBefore - window ? yearBefore : first.time + window;
  const spanDays = (last.time - baseEnd) / DAY_SECONDS;
  if (spanDays < endDays) return null;
  const latest = windowMedian(daily, endDays, 0, last.time);
  const base = windowMedian(daily, endDays, 0, baseEnd);
  return latest !== null && base !== null && base > 0 ? (latest / base) ** (365 / spanDays) - 1 : null;
}

/** Each point as a share of the first point, × 100, so series in different units share one axis; empty when the first value is not positive. */
export function indexTo100(points: DailyPoint[]): DailyPoint[] {
  const base = points[0]?.value ?? 0;
  return base > 0 ? points.map((point) => ({ time: point.time, value: (point.value / base) * 100 })) : [];
}

/** Calendar-month sums (UTC) from `fromTime` on, oldest first, with the number of days summed in each. */
export function monthlySums(daily: DailyPoint[], fromTime: number): Array<{ month: string; value: number; days: number }> {
  const months = new Map<string, { value: number; days: number }>();
  for (const point of daily) {
    if (point.time < fromTime) continue;
    const month = isoDay(point.time).slice(0, 7);
    const sum = months.get(month) ?? { value: 0, days: 0 };
    months.set(month, { value: sum.value + point.value, days: sum.days + 1 });
  }
  return [...months.entries()].map(([month, sum]) => ({ month, ...sum }));
}

/** Validator entry prices. A chunk-validator seat needs `minimumStakeRatio` of total stake;
    block producers are the validators marked `producesBlocks`, so the entry price is the smallest producer stake. */
export function seatPrices(validators: Array<{ stakeNear: number; producesBlocks: boolean }>, minimumStakeRatio: number) {
  const totalStake = validators.reduce((sum, v) => sum + v.stakeNear, 0);
  const producerStakes = validators.filter((v) => v.producesBlocks).map((v) => v.stakeNear);
  return {
    chunkValidatorNear: totalStake * minimumStakeRatio,
    blockProducerNear: producerStakes.length > 0 ? Math.min(...producerStakes) : null,
    producers: producerStakes.length,
  };
}

/** Compound monthly rate equal to `change` over `months`, e.g. +50% over 3 months → ≈ +14.5% a month; null for a fall
    beyond −100% or a span that is not positive, which no rate compounds to. */
export function monthlyRate(change: number, months: number): number | null {
  return change >= -1 && months > 0 ? (1 + change) ** (1 / months) - 1 : null;
}

/** First-of-month points only, oldest first (monthly series such as developer counts). */
export function firstOfMonth(daily: DailyPoint[]): DailyPoint[] {
  return daily.filter((point) => new Date(point.time * 1000).getUTCDate() === 1);
}

/** UTC day "YYYY-MM-DD" of a point's time (unix seconds). */
export function isoDay(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

/** Number of days in a calendar month such as "2026-02". */
export function daysInMonth(month: string): number {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
}

/** Unix seconds of the start of a UTC day "YYYY-MM-DD"; the inverse of isoDay. */
export function dayTime(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / 1000;
}

/** Days from the UTC day `startDay` through `endTime`, both counted. */
export function daysThrough(startDay: string, endTime: number): number {
  return Math.round((endTime - dayTime(startDay)) / DAY_SECONDS) + 1;
}

/** `part ÷ whole`, or null when `whole` is not positive. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** Middle value (mean of the two middle values for an even count), or null for no values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Daily values over the same window as sumWindow, oldest first. */
export function windowValues(daily: DailyPoint[], days: number, offsetDays = 0, endTime = daily.at(-1)?.time ?? 0): number[] {
  const end = endTime - offsetDays * DAY_SECONDS;
  const start = end - days * DAY_SECONDS;
  return daily.filter((point) => point.time > start && point.time <= end).map((point) => point.value);
}

/** Median daily value over the same window as sumWindow; null when no point falls in it. */
export function windowMedian(daily: DailyPoint[], days: number, offsetDays = 0, endTime = daily.at(-1)?.time ?? 0): number | null {
  return median(windowValues(daily, days, offsetDays, endTime));
}

/** True when the series has a value on every day of the window sumWindow would sum, so that sum is not cut short. */
export function coversWindow(daily: DailyPoint[], days: number, offsetDays = 0, endTime = daily.at(-1)?.time ?? 0): boolean {
  const end = endTime - offsetDays * DAY_SECONDS;
  const start = end - days * DAY_SECONDS;
  return daily.filter((point) => point.time > start && point.time <= end).length === days;
}

/** Newest day (unix seconds) from `last` back up to `maxBackDays` whose `days` ending on it every series has, so one missing
    day dates a window earlier instead of emptying it; null when no such day exists. */
export function completeWindowEnd(series: DailyPoint[][], days: number, last: number, maxBackDays: number): number | null {
  for (let back = 0; back <= maxBackDays; back++) {
    const end = last - back * DAY_SECONDS;
    if (series.every((daily) => coversWindow(daily, days, 0, end))) return end;
  }
  return null;
}

/** Yearly rate of a flow over `days` as a share of `base`, e.g. NEAR minted in 30 days ÷ total supply → issuance rate. */
export function annualized(amount: number, days: number, base: number): number | null {
  return days > 0 && base > 0 ? (amount * 365) / days / base : null;
}

/** Day-by-day sum of several series (wallet balances, or revenue plus gas fees), on the days every series has. */
export function sumByDay(...series: DailyPoint[][]): DailyPoint[] {
  const [first, ...rest] = series;
  if (!first) return [];
  const lookups = rest.map((daily) => new Map(daily.map((point) => [point.time, point.value])));
  return first.flatMap((point) => {
    const values = lookups.map((lookup) => lookup.get(point.time));
    return values.every((value) => value !== undefined) ? [{ time: point.time, value: values.reduce((sum, v) => sum + v!, point.value) }] : [];
  });
}

/** Market cap ÷ revenue of the `days` days ending that day, annualized (× 365 ÷ `days`), for each market-cap day whose
    whole revenue window is stored; days with a gap in the window or no revenue are left out. */
export function revenueMultiple(marketCapDaily: DailyPoint[], revenueDaily: DailyPoint[], days: number): DailyPoint[] {
  const revenue = new Map(revenueDaily.map((point) => [point.time, point.value]));
  return marketCapDaily.flatMap((point) => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const value = revenue.get(point.time - i * DAY_SECONDS);
      if (value === undefined) return [];
      sum += value;
    }
    return sum > 0 ? [{ time: point.time, value: point.value / ((sum * 365) / days) }] : [];
  });
}

/** Start of the first calendar month in which every day has a value above zero (unix seconds), or null when none has. */
export function firstFullMonthStart(daily: DailyPoint[]): number | null {
  const days = new Map<string, number>();
  for (const point of daily) {
    if (point.value <= 0) continue;
    const month = isoDay(point.time).slice(0, 7);
    days.set(month, (days.get(month) ?? 0) + 1);
  }
  for (const [month, count] of days) if (count === daysInMonth(month)) return dayTime(`${month}-01`);
  return null;
}

/** Points of `base` and `other` on the days both have, so two chart lines share time stamps by index. */
export function sharedDays(base: DailyPoint[], other: DailyPoint[]): [DailyPoint[], DailyPoint[]] {
  const values = new Map(other.map((p) => [p.time, p.value]));
  const days = base.filter((p) => values.has(p.time));
  return [days, days.map((p) => ({ time: p.time, value: values.get(p.time)! }))];
}

/** Day-by-day `numerator ÷ denominator` for the days both have and the denominator is positive. */
export function ratioByDay(numerator: DailyPoint[], denominator: DailyPoint[]): DailyPoint[] {
  const whole = new Map(denominator.map((point) => [point.time, point.value]));
  return numerator.flatMap((point) => {
    const value = whole.get(point.time);
    return value !== undefined && value > 0 ? [{ time: point.time, value: point.value / value }] : [];
  });
}

/** Calendar-month (UTC) sums of several series over the days the first series has, up to `endTime`, oldest first; the other
    series add only their values on those days. `days` counts the first series' days, so a partly covered month can be told apart. */
export function monthlyTable<K extends string>(series: Record<K, DailyPoint[]>, endTime: number): Array<{ month: string; days: number; sums: Record<K, number> }> {
  const keys = Object.keys(series) as K[];
  const monthOf = (time: number) => isoDay(time).slice(0, 7);
  const rows = new Map<string, { month: string; days: number; sums: Record<K, number> }>();
  const days = new Set<number>();
  for (const point of series[keys[0]!]) {
    if (point.time > endTime) continue;
    const month = monthOf(point.time);
    const row = rows.get(month) ?? { month, days: 0, sums: Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number> };
    row.days++;
    rows.set(month, row);
    days.add(point.time);
  }
  for (const key of keys) {
    for (const point of series[key]) {
      if (days.has(point.time)) rows.get(monthOf(point.time))!.sums[key] += point.value;
    }
  }
  return [...rows.values()];
}

/** NEAR burned and bought against NEAR minted over one window, all measured; shares are of minted NEAR. */
export type Absorption = { days: number; mintedNear: number; burntNear: number; burntShare: number; boughtShare: number; share: number };

/** Absorption of the NEAR minted over `days`; null when nothing was minted. */
export function absorption(days: number, mintedNear: number, burntNear: number, boughtNear: number): Absorption | null {
  if (mintedNear <= 0) return null;
  return {
    days,
    mintedNear,
    burntNear,
    burntShare: burntNear / mintedNear,
    boughtShare: boughtNear / mintedNear,
    share: (burntNear + boughtNear) / mintedNear,
  };
}

/** NEAR Intents money flow over one window: volume → gross fees → revenue → buybacks → NEAR bought, with the fee, buyback and capture rates. */
export type FeeChain = {
  volumeUsd: number;
  feesUsd: number;
  revenueUsd: number;
  buybacksUsd: number;
  boughtNear: number;
  /** Gross fees ÷ volume. */
  feeRate: number | null;
  /** Buybacks ÷ volume. */
  buybackRate: number | null;
  /** Buybacks ÷ gross fees: the share of fees that buys NEAR. */
  captureRate: number | null;
};

export function feeChain(flows: { volumeUsd: number; feesUsd: number; revenueUsd: number; buybacksUsd: number; boughtNear: number }): FeeChain {
  return {
    ...flows,
    feeRate: ratio(flows.feesUsd, flows.volumeUsd),
    buybackRate: ratio(flows.buybacksUsd, flows.volumeUsd),
    captureRate: ratio(flows.buybacksUsd, flows.feesUsd),
  };
}

/** Distance to break-even over one window, at the NEAR minted. `multiple`: minted ÷ (burned + bought), the factor burn plus
    buybacks must grow by. `volumePerDayUsd`: Intents volume a day whose buybacks, at `buybackRate` and `priceUsd`, buy the
    NEAR minted minus the NEAR burned; compare with `currentVolumePerDayUsd`. */
export type BreakEven = { multiple: number | null; volumePerDayUsd: number | null; currentVolumePerDayUsd: number };

export function breakEven(input: {
  days: number;
  mintedNear: number;
  burntNear: number;
  boughtNear: number;
  volumeUsd: number;
  priceUsd: number;
  buybackRate: number | null;
}): BreakEven {
  const neededNear = Math.max(0, input.mintedNear - input.burntNear);
  return {
    multiple: ratio(input.mintedNear, input.burntNear + input.boughtNear),
    volumePerDayUsd: input.buybackRate ? (neededNear * input.priceUsd) / input.buybackRate / input.days : null,
    currentVolumePerDayUsd: input.volumeUsd / input.days,
  };
}

/** Two independent measurements of one quantity. `difference` = a ÷ b − 1; `days` is the window (null for one point in time), `through` its last day. */
export type DataCheck = { a: number; b: number; difference: number | null; days: number | null; through: string };

export function dataCheck(a: number, b: number, days: number | null, throughTime: number): DataCheck {
  const share = ratio(a, b);
  return { a, b, difference: share === null ? null : share - 1, days, through: isoDay(throughTime) };
}
