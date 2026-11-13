import type { IconName } from "@/components/ui/Icon";
import type { SectionId } from "@/content/thesis";

/** Icon of each stat tile on a thesis page, in the order SECTION_STATS (src/lib/thesis/stats.ts) lists the section's stats. */
export const SECTION_STAT_ICONS: Record<SectionId, IconName[]> = {
  demand: ["trend", "change", "calendar", "change"],
  capture: ["bag", "change", "percent", "flame"],
  supply: ["percent", "check", "lock", "coins"],
  valuation: ["change", "target", "divide", "bars"],
  technology: ["clock", "coin"],
  network: ["server", "seat"],
  peers: ["trend", "layers", "divide", "bars"],
};
