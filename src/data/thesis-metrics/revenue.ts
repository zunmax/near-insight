/** NEAR Intents buybacks, the volume → fees → revenue → buybacks chain, and the three fee wallets' balances. */
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { BOUGHT_GROWTH_RANGE } from "@/config/thesis-triggers";
import { windowGrowthRange } from "@/lib/bootstrap";
import { coversWindow, DAY_SECONDS, DAYS_PER_MONTH, daysThrough, dayTime, feeChain, isoDay, monthlyRate, monthlySums, monthlyTable, ratio, sumByDay, sumWindow, toNear, valueAt, windowChange, windowValues, type DailyPoint } from "@/lib/metrics";
import { feesEnd, type FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

/** The three fee wallets' combined daily balance and the window, up to 30 days ending on the data-through day, their gain is compared over. */
export type FeeWalletWindow = {
  total: DailyPoint[];
  /** The last balance day on or before the data-through day; null without one or without a data-through day. */
  checkEnd: number | null;
  /** Days of balance history before checkEnd, at most 30. */
  checkDays: number;
  /** Change of the combined balance over the `days` ending at `endTime`. */
  gain: (endTime: number, days: number) => number;
};

/** NEAR bought over the 30 days to the data-through day. Every day of them must be stored, so a missing day never prints a
    short total as the last 30 days; null otherwise. */
export function boughtNear30d({ through, sum, boughtNear, covered }: FlowContext): number | null {
  return through === null || !covered(boughtNear, 30) ? null : sum(boughtNear, 30);
}

export function buybacksMetrics({ buybacks }: Pick<ThesisInputs, "buybacks">, flow: FlowContext): ThesisMetrics["buybacks"] {
  const { end, sum, boughtNear, takeRate, covered } = flow;
  const bought30dNear = boughtNear30d(flow);
  if (bought30dNear === null) return null;
  /** Growth compares two 90-day windows of buying; while the earlier one starts before buying began, its zero days would
      inflate the growth, so there is none to show yet; nor while a day of either window is missing. */
  const earlierStart = end - 179 * DAY_SECONDS;
  const boughtChange90d = earlierStart >= dayTime(BUYBACKS_START_DAY) && covered(boughtNear, 180) ? windowChange(boughtNear, 90, end) : null;
  const monthlyGrowth = boughtChange90d === null ? null : monthlyRate(boughtChange90d, 90 / DAYS_PER_MONTH);
  /** Percentile ranges can leave out their own estimate on skewed data; widened to include it, the words that compare the
      estimate and the breaking point that compares the range never disagree. */
  const range =
    boughtChange90d === null ? null : windowGrowthRange(windowValues(boughtNear, 90, 0, end), windowValues(boughtNear, 90, 90, end), 90 / DAYS_PER_MONTH, BOUGHT_GROWTH_RANGE);
  return {
    total30dUsd: sum(buybacks, 30),
    bought30dNear,
    change90d: boughtChange90d,
    bought90dNear: boughtChange90d === null ? null : sum(boughtNear, 90),
    boughtPrior90dNear: boughtChange90d === null ? null : sumWindow(boughtNear, 90, 90, end),
    monthlyGrowth,
    monthlyGrowthRange: range && monthlyGrowth !== null ? { low: Math.min(range.low, monthlyGrowth), high: Math.max(range.high, monthlyGrowth) } : range,
    boughtNearTotal: boughtNear.reduce((total, point) => (point.time <= end ? total + point.value : total), 0),
    monthlyNear: monthlySums(boughtNear.filter((point) => point.time <= end), dayTime(BUYBACKS_START_DAY)),
    takeRate90d: takeRate(0),
    takeRatePrior90d: takeRate(90),
  };
}

export function feeChainMetrics(inputs: ThesisInputs, flow: FlowContext): ThesisMetrics["feeChain"] {
  const { volume, intentsFees, intentsRevenue, buybacks, prices } = inputs;
  const { boughtNear } = flow;
  const end = feesEnd(inputs, flow);
  if (end === 0) return null;
  const covered = (daily: DailyPoint[], days: number) => coversWindow(daily, days, 0, end);
  const sum = (daily: DailyPoint[], days: number) => sumWindow(daily, days, 0, end);
  const chainOver = (days: number) =>
    covered(intentsFees, days) && covered(intentsRevenue, days) && covered(volume, days) && covered(boughtNear, days)
      ? feeChain({ volumeUsd: sum(volume, days), feesUsd: sum(intentsFees, days), revenueUsd: sum(intentsRevenue, days), buybacksUsd: sum(buybacks, days), boughtNear: sum(boughtNear, days) })
      : null;
  /** The fee rate needs only fees and volume, so a gap in revenue or buybacks leaves it shown. */
  const feeRateOver = (days: number) => (covered(intentsFees, days) && covered(volume, days) ? ratio(sum(intentsFees, days), sum(volume, days)) : null);
  /** Capture rates count fees from the first day of buying, so fees before buybacks began do not dilute them. */
  const buybacksStart = dayTime(BUYBACKS_START_DAY);
  /** Days in each month since buying began, as "NEAR bought by month" counts them, so the month buying began is partial. */
  const buyingDays = new Map(monthlySums(buybacks.filter((point) => point.time <= end), buybacksStart).map((m) => [m.month, m.days]));
  /** Days in each month with revenue above zero: it was paid in occasional lumps before it was reported every day. */
  const revenueDays = new Map(monthlySums(intentsRevenue.filter((point) => point.value > 0 && point.time <= end), 0).map((m) => [m.month, m.days]));
  const buybackDays = daysThrough(BUYBACKS_START_DAY, end);
  return {
    through: isoDay(end),
    d30: chainOver(30),
    d90: chainOver(90),
    feeRates: { d30: feeRateOver(30), d90: feeRateOver(90) },
    sinceBuybacks: buybackDays > 0 ? chainOver(buybackDays) : null,
    monthly: monthlyTable(
      {
        fees: intentsFees,
        feesSinceBuybacks: intentsFees.filter((point) => point.time >= buybacksStart),
        volume,
        revenue: intentsRevenue,
        revenueNear: toNear(intentsRevenue, prices),
        buybacks,
        bought: boughtNear,
      },
      end,
    ).map(({ month, days, sums }) => ({
      month,
      days,
      buyingDays: buyingDays.get(month) ?? 0,
      revenueDays: revenueDays.get(month) ?? 0,
      revenueNear: sums.revenueNear,
      ...feeChain({ volumeUsd: sums.volume, feesUsd: sums.fees, revenueUsd: sums.revenue, buybacksUsd: sums.buybacks, boughtNear: sums.bought }),
      captureRate: ratio(sums.buybacks, sums.feesSinceBuybacks),
    })),
  };
}

export function feeWalletWindow({ buybackWallet, frontendWallet, oneClickWallet }: ThesisInputs, { through, end }: FlowContext): FeeWalletWindow {
  const total = sumByDay(buybackWallet, frontendWallet, oneClickWallet);
  /** The last stored day on or before `end`: today's live RPC reading sits after a stalled NearBlocks history, so it never extends the window. */
  const checkEnd = through === null ? null : (total.findLast((point) => point.time <= end)?.time ?? null);
  return {
    total,
    checkEnd,
    checkDays: checkEnd === null ? 0 : Math.min(30, Math.floor((checkEnd - total[0]!.time) / DAY_SECONDS)),
    gain: (endTime, days) => valueAt(total, endTime) - valueAt(total, endTime - days * DAY_SECONDS),
  };
}

/** Largest gap, on any day of the `days` ending `checkEnd`, between the NEAR bought since the window began and what the fee
    wallets gained since then. A day's timing or price difference evens out on the next days; NEAR sold or moved out does not. */
function largestShortfall(boughtNear: DailyPoint[], gain: FeeWalletWindow["gain"], checkEnd: number, days: number): number {
  const bought = new Map(boughtNear.map((point) => [point.time, point.value]));
  let boughtSince = 0;
  let largest = 0;
  for (let day = 1; day <= days; day++) {
    const time = checkEnd - (days - day) * DAY_SECONDS;
    boughtSince += bought.get(time) ?? 0;
    largest = Math.max(largest, boughtSince - gain(time, day));
  }
  return largest;
}

export function feeWalletsMetrics(
  { buybackWallet, frontendWallet, oneClickWallet }: ThesisInputs,
  { boughtNear }: FlowContext,
  { total, checkEnd, checkDays, gain }: FeeWalletWindow,
): ThesisMetrics["feeWallets"] {
  const last = total.at(-1);
  const gain30d = checkDays === 30;
  return last
    ? {
        asOf: isoDay(last.time),
        buybackNear: valueAt(buybackWallet, last.time),
        frontendNear: valueAt(frontendWallet, last.time),
        oneClickNear: valueAt(oneClickWallet, last.time),
        totalNear: last.value,
        gain30dNear: gain30d ? gain(checkEnd!, 30) : null,
        gainThrough: checkEnd === null ? null : isoDay(checkEnd),
        bought30dNear: gain30d ? sumWindow(boughtNear, 30, 0, checkEnd!) : null,
        shortfall30dNear: gain30d ? largestShortfall(boughtNear, gain, checkEnd!, 30) : null,
      }
    : null;
}
