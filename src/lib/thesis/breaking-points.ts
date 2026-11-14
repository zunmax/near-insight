import { SECTION_ORDER, sectionName } from "@/content/thesis";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { SECTION_TRIGGERS, TRIGGER_STATUS_LABEL } from "@/lib/thesis/triggers";

/** Every section's breaking point in thesis order: its name, the rule and the latest result in one sentence each, and its status. */
export function breakingPoints(m: ThesisMetrics): Array<{ name: string; rule: string; detail: string; status: string }> {
  return SECTION_ORDER.map((id) => {
    const trigger = SECTION_TRIGGERS[id](m);
    return { name: sectionName(id), rule: trigger.ruleShort, detail: trigger.detailShort, status: TRIGGER_STATUS_LABEL[trigger.status] };
  });
}
