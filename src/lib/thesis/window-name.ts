import type { ThesisMetrics } from "@/data/thesis-metrics";

/** What NEAR bought's monthly growth compares, short enough for one line: the last 90 days against the 90 before. Both
    windows end on the data-through day, which the line's card or row names when it is not current. */
export const MONTHLY_GROWTH_AGAINST = "a month, 90D vs prior 90D";

/** Names a window of `span` ("30 days", "12 months") that ends on `end`: "last 30 days" when it ends on the shared data-through
    day and that day is current, otherwise by its end day, "30 days to 2026-11-04". A window left behind by a stopped source,
    or one ending on another source's day, never reads as the latest one. */
export function windowName(m: Pick<ThesisMetrics, "dataThrough" | "flowsCurrent">, span: string, end: string | null = m.dataThrough): string {
  return end === null || (end === m.dataThrough && m.flowsCurrent) ? `last ${span}` : `${span} to ${end}`;
}
