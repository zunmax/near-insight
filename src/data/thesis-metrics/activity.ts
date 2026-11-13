/** NEAR chain activity (NearBlocks): transactions, new and active accounts against the same 30 days a year earlier. */
import { commonEnd, coversWindow, flowYoY, isoDay, windowMedian } from "@/lib/metrics";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

/** Ends on the last day the three NearBlocks series have, which can differ from dataThrough. */
export function activityMetrics({ txns, active, newAccounts }: ThesisInputs): ThesisMetrics["activity"] {
  if (txns.length === 0 || active.length === 0 || newAccounts.length === 0) return null;
  const activityEnd = commonEnd(txns, active, newAccounts);
  /** A median needs all 30 days stored, the same rule as the chain-activity-yoy query. */
  const median30d = coversWindow(active, 30, 0, activityEnd) ? windowMedian(active, 30, 0, activityEnd) : null;
  const medianYearAgo30d = coversWindow(active, 30, 365, activityEnd) ? windowMedian(active, 30, 365, activityEnd) : null;
  return {
    through: isoDay(activityEnd),
    txns: flowYoY(txns, activityEnd),
    newAccounts: flowYoY(newAccounts, activityEnd),
    activeAccounts: {
      median30d,
      medianYearAgo30d,
      change: median30d !== null && medianYearAgo30d ? median30d / medianYearAgo30d - 1 : null,
    },
  };
}
