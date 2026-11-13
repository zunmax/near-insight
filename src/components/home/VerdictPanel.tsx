import { io } from "next/cache";
import { InlineBold } from "@/components/ui/InlineBold";
import { NoData } from "@/components/ui/NoData";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { thesisVerdict } from "@/lib/thesis/verdict";

const TITLE = "Verdict";

/** Home's verdict post: what the data supports, with any broken or unmeasured breaking points, then the evidence it rests on. */
export async function VerdictPanel() {
  await io();
  const verdict = thesisVerdict(await getThesisMetrics());
  if (!verdict) return <NoData title={TITLE} />;
  return (
    <section aria-labelledby="verdict-title" className="panel h-full">
      <h2 id="verdict-title" className="panel-head panel-title">
        {TITLE}
      </h2>
      <div className="panel-body post-text flex flex-col">
        <p className="text-[17px] leading-[1.45] font-medium text-ink">
          <InlineBold text={verdict.summary} />
        </p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 rounded-[8px] border border-line-strong p-3">
          {verdict.points.map((point) => (
            <li key={point} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
              <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <InlineBold text={point} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Lengths of the verdict's summary and of its points, for the loading placeholder. */
const SKELETON_SUMMARY = 308;
const SKELETON_POINTS = [159, 108, 225, 189, 251, 300, 275];

/** Loading placeholder of VerdictPanel: the summary, then the boxed list of points. */
export function VerdictPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} source={false} textBody>
      <p className="text-[17px] leading-[1.45] font-medium">
        <SkeletonWords chars={SKELETON_SUMMARY} />
      </p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 rounded-[8px] border border-line-strong p-3">
        {SKELETON_POINTS.map((chars, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
            <span className="skeleton mt-[9px] size-1.5 shrink-0 rounded-full" />
            <span>
              <SkeletonWords chars={chars} />
            </span>
          </li>
        ))}
      </ul>
    </PanelSkeleton>
  );
}
