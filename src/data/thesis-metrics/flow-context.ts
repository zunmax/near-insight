/** The shared end day, window helpers and NEAR-denominated flows every thesis metric builder uses. */
import { MAX_PULL_BACK_DAYS } from "@/config/ingest";
import { SOURCES } from "@/config/sources";
import { commonEnd, completeWindowEnd, coversWindow, DAY_SECONDS, dayTime, isoDay, sumWindow, toNear, type DailyPoint } from "@/lib/metrics";
import type { ThesisInputs } from "./inputs";

export type FlowContext = {
  /** Last day (unix seconds) the flow windows end on, or null while a core flow series is empty: `completeEnd` of the core
      series and minted and burned NEAR from the core series' last shared day, or that day when no 30-day window is complete. */
  through: number | null;
  /** `through`, or 0 while it is null. */
  end: number;
  /** `through` as a UTC day. */
  throughDay: string | null;
  /** True while `through` trails the newest market reading by no more than DefiLlama's usual lag plus a day; false once a source has stopped. */
  current: boolean;
  /** True when `daily` covers the `days` ending on `through`. */
  covered: (daily: DailyPoint[], days: number) => boolean;
  /** Last day of a monthly table: `end`, or the last day all its series have when that is earlier. */
  monthlyEnd: (...series: DailyPoint[][]) => number;
  /** Sum of the `days` ending on `end`. */
  sum: (daily: DailyPoint[], days: number) => number;
  /** Chain fees and buybacks with each day's USD converted to NEAR at that day's price. */
  feesNear: DailyPoint[];
  boughtNear: DailyPoint[];
  /** Buybacks ÷ Intents volume over the 90 days ending `offsetDays` before `end`; null unless both cover every one of those days. */
  takeRate: (offsetDays: number) => number | null;
  /** True when minted, burned and bought NEAR all cover the `days` ending on `through`. */
  measured: (days: number) => boolean;
  /** Newest day from `last` back up to MAX_PULL_BACK_DAYS on which every one of `series` covers 30 days, or null: a missing
      day moves a 30-day window earlier, dated by its end, instead of emptying it. */
  completeEnd: (series: DailyPoint[][], last: number) => number | null;
};

/** Last day of the fee windows: `end`, or the last day Intents fees and revenue both have when earlier (the newest fee day is
    still filling, so fees often end a day before the other flows), moved before a day missing from them or Intents volume
    by `completeEnd`; 0 without a data-through day. */
export function feesEnd({ intentsFees, intentsRevenue, volume }: Pick<ThesisInputs, "intentsFees" | "intentsRevenue" | "volume">, { through, monthlyEnd, completeEnd }: FlowContext): number {
  if (through === null) return 0;
  const last = monthlyEnd(intentsFees, intentsRevenue);
  return completeEnd([intentsFees, intentsRevenue, volume], last) ?? last;
}

export function flowContext({ volume, buybacks, fees, prices, minted, burnt, market }: Pick<ThesisInputs, "volume" | "buybacks" | "fees" | "prices" | "minted" | "burnt" | "market">): FlowContext {
  /** Flow windows end on `through` (fee windows on `feesEnd`, which can be earlier); a metric on any other series checks that
      series covers its window to that day, so one late or failing source empties only its own metrics. */
  const flowSeries = [volume, buybacks, fees, prices];
  const last = flowSeries.every((s) => s.length > 0) ? commonEnd(...flowSeries) : null;
  const completeEnd = (series: DailyPoint[][], lastDay: number) => completeWindowEnd(series, 30, lastDay, MAX_PULL_BACK_DAYS);
  /** One missing day of these would empty every 30-day figure, the verdict and the projections until it left the window, so the
      windows end before it instead; a history too short for any complete window keeps the last shared day. */
  const through = last === null ? null : (completeEnd([...flowSeries, minted, burnt], last) ?? last);
  const end = through ?? 0;
  /** Measured against the newest stored reading, not the clock, so the thesis document stays reproducible from a snapshot. */
  const readingDay = market?.fetchedAt ? dayTime(market.fetchedAt.slice(0, 10)) : null;
  const current = through !== null && readingDay !== null && through >= readingDay - (SOURCES.defillama.flowLagDays + 1) * DAY_SECONDS;
  const covered = (daily: DailyPoint[], days: number) => through !== null && coversWindow(daily, days, 0, end);
  /** Monthly tables stop at the last day all their series have, so a late series never leaves its newest month short. */
  const monthlyEnd = (...series: DailyPoint[][]) => Math.min(end, commonEnd(...series));
  const sum = (daily: DailyPoint[], days: number) => sumWindow(daily, days, 0, end);
  const takeRate = (offsetDays: number) => {
    if (through === null || !coversWindow(volume, 90, offsetDays, end) || !coversWindow(buybacks, 90, offsetDays, end)) return null;
    const traded = sumWindow(volume, 90, offsetDays, end);
    return traded > 0 ? sumWindow(buybacks, 90, offsetDays, end) / traded : null;
  };
  const boughtNear = toNear(buybacks, prices);
  /** The core series share their last day, but a day missing inside a window would still cut its sum short, so absorption
      also needs every day of NEAR bought. */
  const measured = (days: number) => covered(minted, days) && covered(burnt, days) && covered(boughtNear, days);
  return {
    through,
    end,
    throughDay: through === null ? null : isoDay(through),
    current,
    covered,
    monthlyEnd,
    sum,
    feesNear: toNear(fees, prices),
    boughtNear,
    takeRate,
    measured,
    completeEnd,
  };
}
