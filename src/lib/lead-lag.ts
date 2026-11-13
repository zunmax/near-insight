/** Lead-lag test: does weekly growth in NEAR Intents volume lead NEAR's price, or NEAR usage, better than price does?
    Pure calculations; inputs come from src/data. Settings are in src/config/lead-lag.ts. */
import { LEAD_LAG } from "@/config/lead-lag";
import { blockDraw, seededRandom } from "@/lib/bootstrap";
import { DAY_SECONDS, isoDay, type DailyPoint } from "@/lib/metrics";

const WEEK_SECONDS = 7 * DAY_SECONDS;

/** One weekly value; `end` is the unix second of the week's last day. */
type WeeklyPoint = { end: number; value: number };

/** Weekly values in 7-day blocks ending at `endTime` and every 7 days before it, oldest first. A block counts only when the
    series has all seven days. `sum` and `mean` combine the days; `last` takes the last day's value (a closing price at week end). */
export function weeklyBlocks(daily: DailyPoint[], aggregate: "sum" | "mean" | "last", endTime: number): WeeklyPoint[] {
  const first = daily[0]?.time;
  if (first === undefined) return [];
  const byDay = new Map(daily.map((point) => [point.time, point.value]));
  const weeks: WeeklyPoint[] = [];
  for (let end = endTime; end - 6 * DAY_SECONDS >= first; end -= WEEK_SECONDS) {
    const days = Array.from({ length: 7 }, (_, i) => byDay.get(end - (6 - i) * DAY_SECONDS));
    if (days.some((value) => value === undefined)) continue;
    const values = days as number[];
    const total = values.reduce((sum, value) => sum + value, 0);
    weeks.push({ end, value: aggregate === "sum" ? total : aggregate === "mean" ? total / 7 : values[6]! });
  }
  return weeks.reverse();
}

/** Log change from each week to the next; pairs with a missing week between them or a non-positive value are left out. */
export function weeklyLogChanges(weeks: WeeklyPoint[]): WeeklyPoint[] {
  return weeks.slice(1).flatMap((week, i) => {
    const previous = weeks[i]!;
    return week.end - previous.end === WEEK_SECONDS && week.value > 0 && previous.value > 0
      ? [{ end: week.end, value: Math.log(week.value / previous.value) }]
      : [];
  });
}

/** The newest run of consecutive weeks every series has, oldest first, with each series' values on those weeks. Lags are
    counted in positions, so a missing week would make one position span two weeks; the weeks before a gap are left out. */
export function alignWeeks(...series: WeeklyPoint[][]): { ends: number[]; values: number[][] } {
  const lookups = series.map((weeks) => new Map(weeks.map((week) => [week.end, week.value])));
  const shared = (series[0] ?? []).map((week) => week.end).filter((end) => lookups.every((lookup) => lookup.has(end)));
  let start = shared.length - 1;
  while (start > 0 && shared[start]! - shared[start - 1]! === WEEK_SECONDS) start--;
  const ends = shared.slice(Math.max(0, start));
  return { ends, values: lookups.map((lookup) => ends.map((end) => lookup.get(end)!)) };
}

/** Whether the first `n` values are all equal. Tested exactly, as deviations from a rounded mean are noise, not zero. */
const isConstant = (values: number[], n: number) => values.slice(0, n).every((value) => value === values[0]);

/** Pearson correlation, clamped to [−1, 1] against rounding; null with fewer than three pairs or a constant series. */
export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3 || isConstant(x, n) || isConstant(y, n)) return null;
  const mean = (values: number[]) => values.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/** Slope of an ordinary least-squares fit of `y` on `x` (with intercept), and what is left of `y` after it; null with fewer than three pairs or a constant `x`. */
export function residualsOn(y: number[], x: number[]): { beta: number; residuals: number[] } | null {
  const n = Math.min(x.length, y.length);
  if (n < 3 || isConstant(x, n)) return null;
  const mx = x.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  const my = y.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
  }
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  return { beta, residuals: y.slice(0, n).map((value, i) => value - alpha - beta * x[i]!) };
}

/** Correlation of `x` with `y` `lag` weeks later, over the weeks both cover: a positive lag means `x` leads. */
export function laggedCorrelation(x: number[], y: number[], lag: number): number | null {
  return pearson(x.slice(0, x.length - lag), y.slice(lag));
}

/** Two-sided p-value of a lagged correlation against `draws` stationary block bootstraps of `x` (Politis and Romano): `x` is rebuilt
    from wrapping blocks of consecutive weeks averaging `meanBlock`, keeping its own pattern but not its alignment with `y`. Seeded,
    so the same data gives the same p-value; the smallest is 1 ÷ (draws + 1). */
export function blockBootstrapPValue(x: number[], y: number[], lag: number, meanBlock: number, draws: number, seed: number): number | null {
  const observed = laggedCorrelation(x, y, lag);
  if (observed === null) return null;
  const n = x.length;
  const random = seededRandom(seed);
  const resampled = new Array<number>(n);
  let counted = 0;
  let asExtreme = 0;
  for (let draw = 0; draw < draws; draw++) {
    blockDraw(x, meanBlock, random, resampled);
    const r = laggedCorrelation(resampled, y, lag);
    if (r === null) continue;
    counted++;
    if (Math.abs(r) >= Math.abs(observed) - 1e-12) asExtreme++;
  }
  return counted > 0 ? (1 + asExtreme) / (1 + counted) : null;
}

/** Holm step-down adjustment for testing several hypotheses at once; adjusted p-values in the order given. */
export function holm(pValues: number[]): number[] {
  const m = pValues.length;
  const adjusted = new Array<number>(m);
  let running = 0;
  pValues
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p)
    .forEach(({ p, i }, rank) => {
      running = Math.max(running, Math.min(1, (m - rank) * p));
      adjusted[i] = running;
    });
  return adjusted;
}

/** The four questions tested: what leads what. "Price" is NEAR's return beyond the market's in the volume questions and NEAR's
    whole return in priceLeadsUsage; usage is daily active accounts. */
export type LeadLagQuestion = "volumeLeadsPrice" | "priceLeadsVolume" | "volumeLeadsUsage" | "priceLeadsUsage";

export type LeadLagTest = {
  question: LeadLagQuestion;
  lag: number;
  r: number | null;
  p: number | null;
  /** After the Holm correction across every test. */
  pAdjusted: number | null;
  significant: boolean;
};

export type LeadLagResult = {
  /** First and last week ends of the price tests (UTC days) and their number of weekly changes. */
  from: string;
  to: string;
  weeks: number;
  /** NEAR's weekly return per unit of the market's (average of BTC and ETH), over the sample. */
  marketBeta: number;
  tests: LeadLagTest[];
};

/** Daily closing prices: the price stored for a day is its 00:00 UTC price, which closes the day before. */
function dailyCloses(prices: DailyPoint[]): DailyPoint[] {
  return prices.map((point) => ({ time: point.time - DAY_SECONDS, value: point.value }));
}

/** Runs every test on weeks ending `endTime`. Volume growth is tested against NEAR's return net of the market (lags 0 to
    maxLagWeeks, and the reverse at 1 to maxLagWeeks); volume growth and NEAR's raw return are each tested as leads of active
    accounts on the same weeks. Null with fewer than minWeeks aligned weeks from the first week of minWeeklyVolumeUsd. */
export function runLeadLag(input: {
  intentsVolumeUsd: DailyPoint[];
  nearPriceUsd: DailyPoint[];
  btcPriceUsd: DailyPoint[];
  ethPriceUsd: DailyPoint[];
  activeAccounts: DailyPoint[];
  endTime: number;
}): LeadLagResult | null {
  const { endTime } = input;
  const volumeWeeks = weeklyBlocks(input.intentsVolumeUsd, "sum", endTime);
  const firstLive = volumeWeeks.findIndex((week) => week.value >= LEAD_LAG.minWeeklyVolumeUsd);
  if (firstLive < 0) return null;
  const volume = weeklyLogChanges(volumeWeeks.slice(firstLive));
  const returns = (prices: DailyPoint[]) => weeklyLogChanges(weeklyBlocks(dailyCloses(prices), "last", endTime));
  const near = returns(input.nearPriceUsd);
  const usage = weeklyLogChanges(weeklyBlocks(input.activeAccounts, "mean", endTime));
  const market = (() => {
    const { ends, values } = alignWeeks(returns(input.btcPriceUsd), returns(input.ethPriceUsd));
    return ends.map((end, i) => ({ end, value: (values[0]![i]! + values[1]![i]!) / 2 }));
  })();

  const priced = alignWeeks(volume, near, market);
  if (priced.ends.length < LEAD_LAG.minWeeks) return null;
  const fit = residualsOn(priced.values[1]!, priced.values[2]!);
  if (!fit) return null;
  const used = alignWeeks(volume, near, usage);

  const lags = (from: number) => Array.from({ length: LEAD_LAG.maxLagWeeks - from + 1 }, (_, i) => from + i);
  const cases: Array<{ question: LeadLagQuestion; lag: number; x: number[]; y: number[] }> = [
    ...lags(0).map((lag) => ({ question: "volumeLeadsPrice" as const, lag, x: priced.values[0]!, y: fit.residuals })),
    ...lags(1).map((lag) => ({ question: "priceLeadsVolume" as const, lag, x: fit.residuals, y: priced.values[0]! })),
    ...(used.ends.length >= LEAD_LAG.minWeeks
      ? [
          ...lags(1).map((lag) => ({ question: "volumeLeadsUsage" as const, lag, x: used.values[0]!, y: used.values[2]! })),
          ...lags(1).map((lag) => ({ question: "priceLeadsUsage" as const, lag, x: used.values[1]!, y: used.values[2]! })),
        ]
      : []),
  ];
  const raw = cases.map(({ x, y, lag }) => ({
    r: laggedCorrelation(x, y, lag),
    p: blockBootstrapPValue(x, y, lag, LEAD_LAG.meanBlockWeeks, LEAD_LAG.nullDraws, LEAD_LAG.seed),
  }));
  const tested = raw.flatMap((result, i) => (result.p === null ? [] : [i]));
  const adjusted = holm(tested.map((i) => raw[i]!.p!));
  const adjustedAt = new Map(tested.map((i, k) => [i, adjusted[k]!]));

  return {
    from: isoDay(priced.ends[0]!),
    to: isoDay(priced.ends.at(-1)!),
    weeks: priced.ends.length,
    marketBeta: fit.beta,
    tests: cases.map(({ question, lag }, i) => {
      const pAdjusted = adjustedAt.get(i) ?? null;
      return { question, lag, r: raw[i]!.r, p: raw[i]!.p, pAdjusted, significant: pAdjusted !== null && pAdjusted <= LEAD_LAG.alpha };
    }),
  };
}
