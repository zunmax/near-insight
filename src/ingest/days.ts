import { DAY_SECONDS, dayTime, isoDay } from "../lib/metrics.ts";

export type DayValue = { day: string; value: number };

/** Uncovered seconds a day may have and still count as complete, such as the one block between two epochs. */
const SPAN_GAP_SECONDS = 60;

/** The UTC day `days` after `day` (before it when negative). */
export function addDays(day: string, days: number): string {
  return isoDay(dayTime(day) + days * DAY_SECONDS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayTime(to) - dayTime(from)) / DAY_SECONDS);
}

/** End-of-day balances for every day from `from` to `to`, from the balances recorded only on days they changed: each day
    carries the last change on or before it. Days before the first change are 0 when `wholeHistory` (the account had no
    earlier balance) and left out otherwise. */
export function fillDailyBalances(changes: DayValue[], from: string, to: string, wholeHistory: boolean): DayValue[] {
  const sorted = changes.filter((c) => c.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  const filled: DayValue[] = [];
  let next = 0;
  let current: number | null = wholeHistory ? 0 : null;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    while (next < sorted.length && sorted[next]!.day <= day) current = sorted[next++]!.value;
    if (current !== null) filled.push({ day, value: current });
  }
  return filled;
}

/** Spreads amounts measured over time spans (unix seconds) onto the UTC days they overlap, in proportion to time.
    Returns only days the spans cover completely, oldest first, so a partly measured day never reads low. */
export function spreadOverDays(spans: Array<{ start: number; end: number; value: number }>): DayValue[] {
  const days = new Map<number, { value: number; covered: number }>();
  for (const span of spans) {
    if (span.end <= span.start) continue;
    for (let dayStart = Math.floor(span.start / DAY_SECONDS) * DAY_SECONDS; dayStart < span.end; dayStart += DAY_SECONDS) {
      const overlap = Math.min(span.end, dayStart + DAY_SECONDS) - Math.max(span.start, dayStart);
      const day = days.get(dayStart) ?? { value: 0, covered: 0 };
      day.value += (span.value * overlap) / (span.end - span.start);
      day.covered += overlap;
      days.set(dayStart, day);
    }
  }
  return [...days.entries()]
    .filter(([, day]) => day.covered >= DAY_SECONDS - SPAN_GAP_SECONDS)
    .sort(([a], [b]) => a - b)
    .map(([dayStart, day]) => ({ day: isoDay(dayStart), value: day.value }));
}

export const today = () => isoDay(Date.now() / 1000);
export const yesterday = () => isoDay(Date.now() / 1000 - DAY_SECONDS);
export const now = () => new Date().toISOString();
export const daysAgo = (days: number) => new Date(Date.now() - days * DAY_SECONDS * 1000).toISOString();
