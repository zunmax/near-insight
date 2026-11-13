import { io } from "next/cache";
import Link from "next/link";
import { SECTION_SKELETONS } from "@/components/thesis/skeleton-shapes";
import { TriggerStatus } from "@/components/thesis/TriggerStatus";
import { sectionAvatarStyle, sectionIconFor } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/Icon";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { SECTIONS, type SectionId } from "@/content/thesis";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SECTION_STATS } from "@/lib/thesis/stats";
import { SECTION_TRIGGERS } from "@/lib/thesis/triggers";

/** Number of live stats shown on a card; the section page shows them all. */
const CARD_STATS = 2;

/** One thesis as a post in the Home thread, linking to its section: its title and claim as the post, and its breaking point
    as a quoted card holding the status, the rule, the headline numbers and what the latest data shows. */
export async function ThesisCard({ id, number, total }: { id: SectionId; number: number; total: number }) {
  await io();
  const section = SECTIONS[id];
  const metrics = await getThesisMetrics();
  const stats = SECTION_STATS[id].stats(metrics)?.slice(0, CARD_STATS) ?? [];
  const trigger = SECTION_TRIGGERS[id](metrics);
  const icon = sectionIconFor(section.href);

  return (
    <div className="panel link-card" style={icon ? sectionAvatarStyle(icon) : undefined}>
      <div className="panel-head justify-start gap-1.5">
        <span className="panel-title">{section.eyebrow}</span>
        <span className="text-[14px] text-muted">
          · {number}/{total}
        </span>
      </div>
      <div className="post-text">
        <h3 className="m-0 text-[15px] font-bold text-ink">
          <Link href={section.href} className="stretched-link">
            {section.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-3 text-[15px] leading-[1.45] text-ink">
          <NoBreakTokens text={section.claim} />
        </p>
      </div>
      <div className="panel-body">
        <p className="flex items-center gap-2 text-[14px] text-ink">
          <Icon name="flag" className="size-[18px] shrink-0" />
          <span className="font-bold">Breaking point</span>
          <TriggerStatus status={trigger.status} className="ml-auto" />
        </p>
        <p className="mt-1 text-[14px] leading-snug text-muted">
          <NoBreakTokens text={trigger.ruleShort} />
        </p>
        {stats.length > 0 ? (
          <dl className="-mx-3 mt-2.5 mb-0 grid grid-cols-2 border-t border-line">
            {/** Label and number share the row lines across both stats, so the numbers line up when one label wraps more. */}
            {stats.map((stat) => (
              <div key={stat.label} className="row-span-2 grid grid-rows-subgrid gap-y-1 px-3 py-2.5 even:border-l even:border-line">
                <dt className="text-[12.5px] leading-snug text-muted">
                  <NoBreakTokens text={stat.label} />
                </dt>
                <dd className="m-0 self-end text-[17px] leading-none font-extrabold whitespace-nowrap text-ink tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className={`-mx-3 -mb-3 border-t border-line px-3 py-2.5 text-[13.5px] leading-snug text-ink-2 ${stats.length > 0 ? "" : "mt-2.5"}`}>
          <NoBreakTokens text={trigger.detailShort} />
        </p>
      </div>
    </div>
  );
}

/** Loading placeholder of a ThesisCard with the section's avatar and the lengths of its own text and live lines. */
export function ThesisCardSkeleton({ id, number, total }: { id: SectionId; number: number; total: number }) {
  const section = SECTIONS[id];
  const shape = SECTION_SKELETONS[id];
  const icon = sectionIconFor(section.href);
  return (
    <div aria-hidden="true" className="panel" style={icon ? sectionAvatarStyle(icon) : undefined}>
      <div className="panel-head justify-start gap-1.5">
        <span className="panel-title">
          <SkeletonWords chars={section.eyebrow.length} />
        </span>
        <span className="text-[14px]">
          <SkeletonWords chars={`· ${number}/${total}`.length} />
        </span>
      </div>
      <div className="post-text">
        <h3 className="m-0 text-[15px] font-bold">
          <SkeletonWords chars={section.title.length} />
        </h3>
        <p className="mt-1 line-clamp-3 text-[15px] leading-[1.45]">
          <SkeletonWords chars={section.claim.length} />
        </p>
      </div>
      <div className="panel-body">
        <p className="flex items-center gap-2 text-[14px]">
          <span className="skeleton size-[18px] shrink-0 rounded-full" />
          <span>
            <SkeletonWords chars={"Breaking point".length} />
          </span>
          <span className="skeleton ml-auto h-6 w-20 rounded-full" />
        </p>
        <p className="mt-1 text-[14px] leading-snug">
          <SkeletonWords chars={shape.card[0]} />
        </p>
        <dl className="-mx-3 mt-2.5 mb-0 grid grid-cols-2 border-t border-line">
          {shape.stats.slice(0, CARD_STATS).map((label, i) => (
            <div key={i} className="row-span-2 grid grid-rows-subgrid gap-y-1 px-3 py-2.5 even:border-l even:border-line">
              <dt className="text-[12.5px] leading-snug">
                <SkeletonWords chars={label} />
              </dt>
              <dd className="m-0 self-end text-[17px] leading-none font-extrabold">
                <SkeletonWords chars={5} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="-mx-3 -mb-3 border-t border-line px-3 py-2.5 text-[13.5px] leading-snug">
          <SkeletonWords chars={shape.card[1]} />
        </p>
      </div>
    </div>
  );
}
