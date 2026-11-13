import { BUYBACKS_START_DAY, MAX_ISSUANCE_HALVED_DAY } from "@/config/protocol";
import { dayTime } from "@/lib/metrics";

/** A dated event drawn on a time chart as a dashed line with a short label. `time` is unix seconds. */
export type ChartMarker = { time: number; label: string };

/** Events that explain step changes in the supply and buyback charts. */
export const MILESTONES = {
  issuanceHalved: { time: dayTime(MAX_ISSUANCE_HALVED_DAY), label: "Max issuance halved" },
  buybacksStart: { time: dayTime(BUYBACKS_START_DAY), label: "Buybacks start" },
} satisfies Record<string, ChartMarker>;
