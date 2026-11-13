import { TRIGGER_STATUS_LABEL, type TriggerStatus as Status } from "@/lib/thesis/triggers";

/** Chip colors of each status: green while the thesis holds, red once its breaking point is reached, amber while the data
    cannot tell, gray without data. */
const TONE: Record<Status, string> = {
  "not-happened": "bg-up/15 text-up",
  happened: "bg-down/15 text-down",
  "too-close": "bg-caution/15 text-caution",
  "no-data": "bg-surface-3 text-muted",
};

/** Whether a thesis's breaking point has been reached, as a tinted chip with a dot and a label. */
export function TriggerStatus({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 align-[1px] text-[12.5px] font-bold whitespace-nowrap ${TONE[status]} ${className}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {TRIGGER_STATUS_LABEL[status]}
    </span>
  );
}
