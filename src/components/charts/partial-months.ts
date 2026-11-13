import { formatMonth, monthStart } from "@/components/charts/chart-format";
import { daysInMonth } from "@/lib/metrics";

/** True when a monthly row holds every day of its calendar month. */
export const isCompleteMonth = (row: { month: string; days: number }) => row.days >= daysInMonth(row.month);

/** Position of the newest complete month in `rows`, or undefined when none is complete. */
export function lastCompleteIndex(rows: Array<{ month: string; days: number }>): number | undefined {
  const index = rows.findLastIndex(isCompleteMonth);
  return index < 0 ? undefined : index;
}

/** Positions of the first and last rows when they hold fewer days than their calendar month; only the ends of a range can. */
export function partialMonthIndexes(rows: Array<{ month: string; days: number }>): number[] {
  const ends = rows.length > 1 ? [0, rows.length - 1] : rows.length === 1 ? [0] : [];
  return ends.filter((i) => !isCompleteMonth(rows[i]!));
}

/** A sentence naming the first and last months that hold fewer days than the calendar month, or null when both are complete. */
export function partialMonthsNote(rows: Array<{ month: string; days: number }>): string | null {
  const names = partialMonthIndexes(rows).map((i) => formatMonth(monthStart(rows[i]!.month)));
  if (names.length === 0) return null;
  return names.length === 1 ? `${names[0]} covers only part of the month.` : `${names[0]} and ${names[1]} each cover only part of the month.`;
}
