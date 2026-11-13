import { io } from "next/cache";
import type { CSSProperties } from "react";
import { SECTION_SKELETONS } from "@/components/thesis/skeleton-shapes";
import { SECTION_STAT_ICONS } from "@/components/thesis/stat-icons";
import { TriggerStatus } from "@/components/thesis/TriggerStatus";
import { avatarStyle } from "@/components/ui/avatar";
import { InlineBold } from "@/components/ui/InlineBold";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { SECTIONS, type SectionId } from "@/content/thesis";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SECTION_FINDINGS } from "@/lib/thesis/findings";
import { SECTION_STATS, type SectionStat } from "@/lib/thesis/stats";
import { SECTION_TRIGGERS } from "@/lib/thesis/triggers";

/** Entrance order: the stat tiles one after another, and the bull case, bear case and breaking point posts one after another;
    globals.css (`main:has(.kpi-block) > .enter`) starts the posts once the tiles have begun. */
const order = (i: number) => ({ "--i": i + 1 }) as CSSProperties;

/** Avatars of the bull and bear case posts: a thumb up on green for the evidence for the claim,
    a thumb down on red against it. */
const EVIDENCE_AVATARS = {
  for: avatarStyle("M6.5 9v8H3.5V9h3Zm0 0 3-6c1.4 0 2.3 1 2 2.4L11 8h4.3c1 0 1.8.9 1.6 1.9l-1.1 5.6c-.2.9-.9 1.5-1.8 1.5H6.5", 20, "var(--up)"),
  against: avatarStyle("M6.5 11V3H3.5v8h3Zm0 0 3 6c1.4 0 2.3-1 2-2.4L11 12h4.3c1 0 1.8-.9 1.6-1.9l-1.1-5.6C15.6 3.6 14.9 3 14 3H6.5", 20, "var(--down)"),
};

/** Avatar of the "Breaking point" post: a flag on gray. */
const BREAKING_POINT_AVATAR = avatarStyle("M5 21V4m0 1h11.5l-2.5 4.5 2.5 4.5H5", 24, "var(--muted)");

/** Title row of an evidence post. */
function EvidenceHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="panel-head panel-title justify-start">
      {children}
    </h2>
  );
}

/** Live numbers inside an evidence post. */
function EvidenceStats({ stats }: { stats: SectionStat[] }) {
  if (stats.length === 0) return null;
  return (
    <dl className="m-0 mt-3 grid gap-3 rounded-[8px] border border-line-strong p-3 sm:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-[13px] leading-snug text-muted">
            <NoBreakTokens text={stat.label} />
          </dt>
          <dd className="m-0 mt-1 text-[18px] leading-none font-extrabold text-ink tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A thesis page's live part under its header (ThesisPageHeader): the key numbers as stat tiles, the bull and bear case
    posts written from live data, and the breaking point with its status, each directly in the feed. */
export async function ThesisHeader({ id }: { id: SectionId }) {
  await io();
  const section = SECTIONS[id];
  const sectionStats = SECTION_STATS[id];
  const metrics = await getThesisMetrics();
  const stats = sectionStats.stats(metrics);
  const evidenceStats = sectionStats.against(metrics) ?? [];
  const statsFor = evidenceStats.filter((stat) => stat.supports === true);
  const statsAgainst = evidenceStats.filter((stat) => stat.supports !== true);
  const finding = SECTION_FINDINGS[id](metrics);
  const trigger = SECTION_TRIGGERS[id](metrics);
  if (!stats) return <NoData title={section.title} />;

  return (
    <>
      {stats.length > 0 ? (
        <dl id={id} className="kpi-block tile-grid scroll-mt-16">
          {stats.map((stat, i) => (
            <KpiCard key={stat.label} label={stat.label} value={stat.value} icon={SECTION_STAT_ICONS[id][i]} className="enter" style={order(i)} />
          ))}
        </dl>
      ) : null}

      {/** No bull case post while the data backs none of the claim, rather than an empty one. */}
      {finding.for.length > 0 || statsFor.length > 0 ? (
        <section aria-labelledby={`${id}-for`} className="panel enter" style={{ ...order(0), ...EVIDENCE_AVATARS.for }}>
          <EvidenceHeading id={`${id}-for`}>Bull case</EvidenceHeading>
          <div className="panel-body post-text">
            {finding.for.length > 0 ? (
              <p className="text-[15px] leading-[1.45] text-ink">
                <InlineBold text={finding.for.join(" ")} />
              </p>
            ) : null}
            <EvidenceStats stats={statsFor} />
          </div>
        </section>
      ) : null}
      <section aria-labelledby={`${id}-against`} className="panel enter" style={{ ...order(1), ...EVIDENCE_AVATARS.against }}>
        <EvidenceHeading id={`${id}-against`}>Bear case</EvidenceHeading>
        <div className="panel-body post-text">
          <p className="text-[15px] leading-[1.45] text-ink">
            <InlineBold text={finding.against.map((text) => `${text} `).join("")} />
            <span className="max-md:hidden">
              <NoBreakTokens text={section.against} />
            </span>
            <span className="md:hidden">
              <NoBreakTokens text={section.againstShort} />
            </span>
          </p>
          <EvidenceStats stats={statsAgainst} />
        </div>
      </section>
      <section aria-labelledby={`${id}-break`} className="panel enter" style={{ ...order(2), ...BREAKING_POINT_AVATAR }}>
        <EvidenceHeading id={`${id}-break`}>Breaking point</EvidenceHeading>
        <div className="panel-body post-text">
          <p className="text-[15px] leading-[1.45] text-ink">
            <NoBreakTokens text={trigger.rule} />
          </p>
          <p className="mt-3 text-[15px] leading-[1.45] text-ink">
            <TriggerStatus status={trigger.status} className="mr-1.5" />
            <NoBreakTokens text={trigger.detail} />
          </p>
        </div>
      </section>
    </>
  );
}

/** Post text in a placeholder evidence post. */
function EvidenceTextSkeleton({ chars, className = "" }: { chars: number; className?: string }) {
  return (
    <p className={`text-[15px] leading-[1.45] ${className}`}>
      <SkeletonWords chars={chars} />
    </p>
  );
}

/** Loading placeholder of ThesisHeader: the stat tiles, then the bull case, bear case and breaking point posts with their
    own avatars and the section's text lengths, so the feed below does not move when they load. */
export function ThesisHeaderSkeleton({ id }: { id: SectionId }) {
  const section = SECTIONS[id];
  const shape = SECTION_SKELETONS[id];
  return (
    <>
      <dl aria-hidden="true" className="kpi-block tile-grid">
        {shape.stats.map((label, i) => (
          <KpiCardSkeleton key={i} label={label} />
        ))}
      </dl>
      <PanelSkeleton title={"Bull case".length} source={false} textBody style={EVIDENCE_AVATARS.for}>
        <EvidenceTextSkeleton chars={shape.bull} />
      </PanelSkeleton>
      <PanelSkeleton title={"Bear case".length} source={false} textBody style={EVIDENCE_AVATARS.against}>
        <p className="text-[15px] leading-[1.45]">
          <SkeletonWords chars={shape.bear} />{" "}
          <span className="max-md:hidden">
            <SkeletonWords chars={section.against.length} />
          </span>
          <span className="md:hidden">
            <SkeletonWords chars={section.againstShort.length} />
          </span>
        </p>
        <dl className="m-0 mt-3 grid gap-3 rounded-[8px] border border-line-strong p-3 sm:grid-cols-2">
          {shape.bearStats.map((label, i) => (
            <div key={i}>
              <dt className="text-[13px] leading-snug">
                <SkeletonWords chars={label} />
              </dt>
              <dd className="m-0 mt-1 text-[18px] leading-none font-extrabold">
                <SkeletonWords chars={5} />
              </dd>
            </div>
          ))}
        </dl>
      </PanelSkeleton>
      <PanelSkeleton title={"Breaking point".length} source={false} textBody style={BREAKING_POINT_AVATAR}>
        <EvidenceTextSkeleton chars={shape.breaking[0]} />
        <EvidenceTextSkeleton chars={shape.breaking[1]} className="mt-3" />
      </PanelSkeleton>
    </>
  );
}
