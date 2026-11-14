import { io } from "next/cache";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { LeadLagQuestions, LeadLagQuestionsSkeleton } from "@/components/usage/LeadLagQuestions";
import { LEAD_LAG } from "@/config/lead-lag";
import { LEAD_LAG_QUESTIONS as QUESTIONS } from "@/content/lead-lag";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatInteger, formatMultiple, formatPercent } from "@/lib/format";
import type { LeadLagQuestion } from "@/lib/lead-lag";

const TITLE = "Lead-lag tests: NEAR Intents volume, NEAR's price and active accounts";

/** Weekly lead-lag correlations with Holm-adjusted p-values, one question at a time. */
export async function LeadLagPanel() {
  await io();
  const { leadLag, dataThrough } = await getThesisMetrics();
  if (!leadLag) return <NoData title={TITLE} />;
  const significant = leadLag.tests.filter((t) => t.significant).length;
  const groups = (Object.keys(QUESTIONS) as LeadLagQuestion[])
    .map((question) => ({ question, tests: leadLag.tests.filter((t) => t.question === question) }))
    .filter(({ tests }) => tests.length > 0);

  return (
    <Panel
      title={TITLE}
      sources={["dune", "defillama", "nearblocks"]}
      through={`Weeks through ${dataThrough}`}
      sqlId="lead-lag-weekly"
      viewLabel="Values"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[30px] leading-none font-extrabold tabular-nums">
          {significant} of {leadLag.tests.length}
        </p>
        <p className="text-[13px] text-muted">tests significant at {formatPercent(LEAD_LAG.alpha, 0)} (unlikely to be chance) after the Holm correction for running many tests at once</p>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        <NoBreakTokens
          text={`${leadLag.weeks} weekly changes from ${leadLag.from} to ${leadLag.to}. NEAR's weekly return moved ${formatMultiple(leadLag.marketBeta, 2)} the market's (the average of BTC and ETH). Tests against NEAR Intents volume remove that market part first; tests against active accounts use NEAR's whole return.`}
        />
      </p>
      <LeadLagQuestions groups={groups} />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        <NoBreakTokens
          text={`Weekly log changes in 7-day blocks ending on ${dataThrough}, from the first week with at least $${LEAD_LAG.minWeeklyVolumeUsd / 1e6}M of NEAR Intents volume. p-values compare each correlation with ${formatInteger(LEAD_LAG.nullDraws)} stationary block bootstraps of the leading series (blocks of ${LEAD_LAG.meanBlockWeeks} weeks on average), which keep its week-to-week pattern but break its timing.`}
        />
      </p>
    </Panel>
  );
}

/** Loading placeholder of LeadLagPanel. */
export function LeadLagPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Values">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[30px] leading-none font-extrabold">
          <SkeletonWords chars={7} />
        </p>
        <p className="text-[13px]">
          <SkeletonWords chars={104} />
        </p>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed">
        <SkeletonWords chars={244} />
      </p>
      <LeadLagQuestionsSkeleton />
      <NoteSkeleton chars={304} />
    </PanelSkeleton>
  );
}
